import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const dataDir = process.env.TACHYON_DATA_DIR
  ? path.resolve(process.env.TACHYON_DATA_DIR)
  : path.join(rootDir, "data");
const uploadDir = process.env.TACHYON_UPLOAD_DIR
  ? path.resolve(process.env.TACHYON_UPLOAD_DIR)
  : path.join(rootDir, "uploads");
const homeFile = path.join(dataDir, "home.json");
const homeEnFile = path.join(dataDir, "home-en.json");
const introFile = path.join(dataDir, "intro.json");
const introEnFile = path.join(dataDir, "intro-en.json");
const historyFile = path.join(dataDir, "history.json");
const membersFile = path.join(dataDir, "members.json");
const sponsorsFile = path.join(dataDir, "sponsors.json");
const contactFile = path.join(dataDir, "contact.json");
const visitsFile = path.join(dataDir, "visits.json");
const sitePagesFile = path.join(dataDir, "site-pages.json");
const authFile = path.join(dataDir, "auth.json");

const port = Number(process.env.PORT || 4321);
const initialAdminPassword = process.env.TACHYON_ADMIN_PASSWORD || "dev-password";
const sessionSecret = process.env.TACHYON_SESSION_SECRET || randomBytes(32).toString("hex");
const sessionCookie = "tachyon_admin";
const maxJsonSize = 2 * 1024 * 1024;
const maxUploadSize = 8 * 1024 * 1024;
const minPasswordLength = 8;
let visitWriteQueue = Promise.resolve();

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".ico", "image/x-icon"],
]);

const defaultMembersData = {
  seasons: [],
  archive: {
    title: "Members Archive",
    subtitle: "",
    groups: [],
  },
  ob: {
    title: "OB Members",
    subtitle: "",
    teamPhotos: [],
    members: [],
  },
};

const defaultHomeData = {
  title: "Tachyon",
  description: "",
  hero: {
    lightImage: "",
    darkImage: "",
    alt: "",
    title: "",
    lead: "",
  },
  cards: [],
  contact: {
    title: "With US",
    photos: [],
    links: [],
  },
};

const defaultHomeEnData = {
  ...defaultHomeData,
  description: "Chungbuk National University student formula team",
  contact: {
    title: "With Us",
    photos: [],
    links: [],
  },
};

const defaultIntroData = {
  title: "동아리 소개",
  description: "",
  sections: [],
  organization: {
    title: "Organization",
    image: "",
    alt: "",
  },
};

const defaultIntroEnData = {
  title: "About Us",
  description: "",
  sections: [],
  organization: {
    title: "Organization",
    image: "",
    alt: "",
  },
};

const defaultHistoryData = {
  title: "Our Cars",
  description: "",
  vehicleSectionTitle: "History",
  groups: [],
  awards: {
    title: "역대 수상 내역",
    items: [],
  },
};

const defaultSponsorsData = {
  title: "Sponsors",
  description: "",
  heroImage: "",
  items: [],
};

const defaultContactData = {
  title: "Contact Us",
  subtitle: "",
  heroImage: "",
  contacts: [],
  socials: [],
};

const defaultVisitsData = {
  total: 0,
  pages: {},
  days: {},
  updatedAt: "",
};

const defaultSitePages = [
  {
    name: "Members",
    route: "/members",
    file: "data/members.json",
    editor: "members",
  },
];

const ensureDir = (dir) => mkdir(dir, { recursive: true });

const fileExists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(data));
};

const sendText = (res, statusCode, text) => {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(text);
};

const redirect = (res, location) => {
  res.writeHead(302, { location });
  res.end();
};

const hashValue = (value) => createHash("sha256").update(String(value)).digest();

const secureCompare = (left, right) => {
  const leftHash = hashValue(left);
  const rightHash = hashValue(right);
  return timingSafeEqual(leftHash, rightHash);
};

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { algorithm: "scrypt", salt, hash };
};

const verifyPasswordHash = (password, auth) => {
  if (auth?.algorithm !== "scrypt" || !auth.salt || !auth.hash) {
    return false;
  }

  const expected = Buffer.from(auth.hash, "hex");
  const actual = scryptSync(String(password), auth.salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const readAuth = async () => {
  if (await fileExists(authFile)) {
    return JSON.parse(await readFile(authFile, "utf8"));
  }

  return null;
};

const authenticateAdminPassword = async (password) => {
  const auth = await readAuth();
  if (auth) {
    return verifyPasswordHash(password, auth);
  }

  return secureCompare(password || "", initialAdminPassword);
};

const updateAdminPassword = async (newPassword) => {
  await ensureDir(dataDir);
  await writeFile(authFile, `${JSON.stringify(hashPassword(newPassword), null, 2)}\n`, "utf8");
};

const parseCookies = (header = "") =>
  Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return index === -1
          ? [item, ""]
          : [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      }),
  );

const sign = (value) => createHmac("sha256", sessionSecret).update(value).digest("base64url");

const createSessionToken = () => {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const verifySessionToken = (token) => {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!secureCompare(signature, sign(payload))) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
};

const isAuthenticated = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(cookies[sessionCookie]);
};

const requireAdmin = (req, res) => {
  if (isAuthenticated(req)) {
    return true;
  }
  sendJson(res, 401, { error: "로그인이 필요합니다." });
  return false;
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxJsonSize) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });

const normalizeMembersData = (data) => ({
  seasons: Array.isArray(data?.seasons) ? data.seasons : [],
  archive: {
    title: data?.archive?.title || "Members Archive",
    subtitle: data?.archive?.subtitle || "",
    groups: Array.isArray(data?.archive?.groups) ? data.archive.groups : [],
  },
  ob: {
    title: data?.ob?.title || "OB Members",
    subtitle: data?.ob?.subtitle || "",
    teamPhotos: Array.isArray(data?.ob?.teamPhotos) ? data.ob.teamPhotos : [],
    members: Array.isArray(data?.ob?.members) ? data.ob.members : [],
  },
});

const readMembers = async () => {
  if (!(await fileExists(membersFile))) {
    await ensureDir(dataDir);
    await writeFile(membersFile, `${JSON.stringify(defaultMembersData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(membersFile, "utf8"));
  return normalizeMembersData(data);
};

const writeMembers = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeMembersData(data);
  const tempFile = `${membersFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, membersFile);
  return normalized;
};

const normalizeHomeData = (data = {}) => ({
  title: String(data?.title || "Tachyon").trim(),
  description: String(data?.description || "").trim(),
  hero: {
    lightImage: String(data?.hero?.lightImage || "").trim(),
    darkImage: String(data?.hero?.darkImage || "").trim(),
    alt: String(data?.hero?.alt || "").trim(),
    title: String(data?.hero?.title || "").trim(),
    lead: String(data?.hero?.lead || "").trim(),
  },
  cards: (Array.isArray(data?.cards) ? data.cards : [])
    .map((item) => ({
      label: String(item?.label || "").trim(),
      href: String(item?.href || "").trim(),
      image: String(item?.image || "").trim(),
      alt: String(item?.alt || "").trim(),
    }))
    .filter((item) => item.label || item.href || item.image || item.alt),
  contact: {
    title: String(data?.contact?.title || "With US").trim(),
    photos: (Array.isArray(data?.contact?.photos) ? data.contact.photos : [])
      .map((item) => ({
        href: String(item?.href || "").trim(),
        image: String(item?.image || "").trim(),
        alt: String(item?.alt || "").trim(),
      }))
      .filter((item) => item.href || item.image || item.alt),
    links: (Array.isArray(data?.contact?.links) ? data.contact.links : [])
      .map((item) => ({
        label: String(item?.label || "").trim(),
        href: String(item?.href || "").trim(),
      }))
      .filter((item) => item.label || item.href),
  },
});

const readHome = async () => {
  if (!(await fileExists(homeFile))) {
    await ensureDir(dataDir);
    await writeFile(homeFile, `${JSON.stringify(defaultHomeData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(homeFile, "utf8"));
  return normalizeHomeData(data);
};

const writeHome = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeHomeData(data);
  const tempFile = `${homeFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, homeFile);
  return normalized;
};

const readHomeEn = async () => {
  if (!(await fileExists(homeEnFile))) {
    await ensureDir(dataDir);
    await writeFile(homeEnFile, `${JSON.stringify(defaultHomeEnData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(homeEnFile, "utf8"));
  return normalizeHomeData(data);
};

const writeHomeEn = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeHomeData(data);
  const tempFile = `${homeEnFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, homeEnFile);
  return normalized;
};

const normalizeIntroData = (data = {}) => ({
  title: String(data?.title || "동아리 소개").trim(),
  description: String(data?.description || "").trim(),
  sections: (Array.isArray(data?.sections) ? data.sections : [])
    .map((section) => ({
      heading: String(section?.heading || "").trim(),
      paragraphs: (Array.isArray(section?.paragraphs) ? section.paragraphs : [])
        .map((paragraph) => String(paragraph || "").trim())
        .filter(Boolean),
    }))
    .filter((section) => section.heading || section.paragraphs.length),
  organization: {
    title: String(data?.organization?.title || "Organization").trim(),
    image: String(data?.organization?.image || "").trim(),
    alt: String(data?.organization?.alt || "").trim(),
  },
});

const readIntro = async () => {
  if (!(await fileExists(introFile))) {
    await ensureDir(dataDir);
    await writeFile(introFile, `${JSON.stringify(defaultIntroData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(introFile, "utf8"));
  return normalizeIntroData(data);
};

const writeIntro = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeIntroData(data);
  const tempFile = `${introFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, introFile);
  return normalized;
};

const readIntroEn = async () => {
  if (!(await fileExists(introEnFile))) {
    await ensureDir(dataDir);
    await writeFile(introEnFile, `${JSON.stringify(defaultIntroEnData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(introEnFile, "utf8"));
  return normalizeIntroData(data);
};

const writeIntroEn = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeIntroData(data);
  const tempFile = `${introEnFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, introEnFile);
  return normalized;
};

const normalizeHistoryData = (data = {}) => ({
  title: String(data?.title || "Our Cars").trim(),
  description: String(data?.description || "").trim(),
  vehicleSectionTitle: String(data?.vehicleSectionTitle || "History").trim(),
  groups: (Array.isArray(data?.groups) ? data.groups : [])
    .map((group) => ({
      title: String(group?.title || "").trim(),
      vehicles: (Array.isArray(group?.vehicles) ? group.vehicles : [])
        .map((vehicle) => ({
          name: String(vehicle?.name || "").trim(),
          year: String(vehicle?.year || "").trim(),
          competition: String(vehicle?.competition || "").trim(),
          award: String(vehicle?.award || "").trim(),
          image: String(vehicle?.image || "").trim(),
          alt: String(vehicle?.alt || "").trim(),
        }))
        .filter((vehicle) => vehicle.name || vehicle.year || vehicle.competition || vehicle.award || vehicle.image || vehicle.alt),
    }))
    .filter((group) => group.title || group.vehicles.length),
  awards: {
    title: String(data?.awards?.title || "역대 수상 내역").trim(),
    items: (Array.isArray(data?.awards?.items) ? data.awards.items : [])
      .map((item) => ({
        year: String(item?.year || "").trim(),
        competition: String(item?.competition || "").trim(),
        vehicle: String(item?.vehicle || "").trim(),
        result: String(item?.result || "").trim(),
      }))
      .filter((item) => item.year || item.competition || item.vehicle || item.result),
  },
});

const readHistory = async () => {
  if (!(await fileExists(historyFile))) {
    await ensureDir(dataDir);
    await writeFile(historyFile, `${JSON.stringify(defaultHistoryData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(historyFile, "utf8"));
  return normalizeHistoryData(data);
};

const writeHistory = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeHistoryData(data);
  const tempFile = `${historyFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, historyFile);
  return normalized;
};

const normalizeSponsorsData = (data) => ({
  title: String(data?.title || "Sponsors").trim(),
  description: String(data?.description || "").trim(),
  heroImage: String(data?.heroImage || "").trim(),
  items: (Array.isArray(data?.items) ? data.items : [])
    .map((item) => ({
      name: String(item?.name || "").trim(),
      url: String(item?.url || "").trim(),
      logo: String(item?.logo || "").trim(),
    }))
    .filter((item) => item.name),
});

const readSponsors = async () => {
  if (!(await fileExists(sponsorsFile))) {
    await ensureDir(dataDir);
    await writeFile(sponsorsFile, `${JSON.stringify(defaultSponsorsData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(sponsorsFile, "utf8"));
  return normalizeSponsorsData(data);
};

const writeSponsors = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeSponsorsData(data);
  const tempFile = `${sponsorsFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, sponsorsFile);
  return normalized;
};

const normalizeContactData = (data) => ({
  title: String(data?.title || "Contact Us").trim(),
  subtitle: String(data?.subtitle || "").trim(),
  heroImage: String(data?.heroImage || "").trim(),
  contacts: (Array.isArray(data?.contacts) ? data.contacts : [])
    .map((item) => ({
      role: String(item?.role || "").trim(),
      name: String(item?.name || "").trim(),
      phone: String(item?.phone || "").trim(),
      email: String(item?.email || "").trim(),
    }))
    .filter((item) => item.role || item.name || item.phone || item.email),
  socials: (Array.isArray(data?.socials) ? data.socials : [])
    .map((item) => ({
      name: String(item?.name || "").trim(),
      url: String(item?.url || "").trim(),
      image: String(item?.image || "").trim(),
    }))
    .filter((item) => item.name || item.url || item.image),
});

const readContact = async () => {
  if (!(await fileExists(contactFile))) {
    await ensureDir(dataDir);
    await writeFile(contactFile, `${JSON.stringify(defaultContactData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(contactFile, "utf8"));
  return normalizeContactData(data);
};

const writeContact = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeContactData(data);
  const tempFile = `${contactFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, contactFile);
  return normalized;
};

const visitDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const visitDayKey = (date = new Date()) => {
  const parts = Object.fromEntries(visitDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const recentVisitDayKeys = () => {
  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  return Array.from({ length: 7 }, (_, index) => visitDayKey(new Date(today.getTime() - (6 - index) * dayMs)));
};

const normalizeVisitPages = (rawPages = {}) => {
  const pages = {};
  for (const [route, count] of Object.entries(rawPages || {})) {
    const normalizedRoute = String(route || "").trim();
    const normalizedCount = Number(count);
    if (normalizedRoute && Number.isFinite(normalizedCount)) {
      pages[normalizedRoute] = Math.max(0, Math.floor(normalizedCount));
    }
  }
  return pages;
};

const normalizeVisitsData = (data = {}) => {
  const pages = normalizeVisitPages(data?.pages);
  const dayKeys = new Set(recentVisitDayKeys());
  const days = {};

  for (const [day, value] of Object.entries(data?.days || {})) {
    if (!dayKeys.has(day)) {
      continue;
    }

    const dayPages = normalizeVisitPages(value?.pages);
    const dayTotal = Number(value?.total);
    days[day] = {
      total: Number.isFinite(dayTotal) ? Math.max(0, Math.floor(dayTotal)) : Object.values(dayPages).reduce((sum, count) => sum + count, 0),
      pages: dayPages,
    };
  }

  const total = Number(data?.total);
  return {
    total: Number.isFinite(total) ? Math.max(0, Math.floor(total)) : Object.values(pages).reduce((sum, count) => sum + count, 0),
    pages,
    days,
    updatedAt: String(data?.updatedAt || ""),
  };
};

const readVisits = async () => {
  if (!(await fileExists(visitsFile))) {
    await ensureDir(dataDir);
    await writeFile(visitsFile, `${JSON.stringify(defaultVisitsData, null, 2)}\n`, "utf8");
  }

  const data = JSON.parse(await readFile(visitsFile, "utf8"));
  return normalizeVisitsData(data);
};

const writeVisits = async (data) => {
  await ensureDir(dataDir);
  const normalized = normalizeVisitsData(data);
  const tempFile = `${visitsFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  await rename(tempFile, visitsFile);
  return normalized;
};

const normalizeSitePages = (pages) =>
  (Array.isArray(pages) ? pages : [])
    .map((page) => ({
      name: String(page?.name || "").trim(),
      route: String(page?.route || "").trim(),
      file: String(page?.file || "").trim(),
      editor: String(page?.editor || "").trim(),
    }))
    .filter((page) => page.name && page.route && page.file);

const readSitePages = async () => {
  if (!(await fileExists(sitePagesFile))) {
    await ensureDir(dataDir);
    await writeFile(sitePagesFile, `${JSON.stringify(defaultSitePages, null, 2)}\n`, "utf8");
  }

  const pages = JSON.parse(await readFile(sitePagesFile, "utf8"));
  return normalizeSitePages(pages);
};

const parseMultipartForm = async (req) => {
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: Readable.toWeb(req),
    duplex: "half",
  });
  return request.formData();
};

const sanitizeSegment = (value, fallback) => {
  const sanitized = String(value || "")
    .trim()
    .replace(/[^0-9a-zA-Z가-힣_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized || fallback;
};

const uploadImage = async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > maxUploadSize + 1024 * 512) {
    sendJson(res, 413, { error: "업로드 파일이 너무 큽니다." });
    return;
  }

  const form = await parseMultipartForm(req);
  const file = form.get("file");
  const category = sanitizeSegment(form.get("category"), "members");
  const bucket = sanitizeSegment(form.get("year") || form.get("bucket"), "general");

  if (!file || typeof file.arrayBuffer !== "function") {
    sendJson(res, 400, { error: "업로드할 이미지가 없습니다." });
    return;
  }

  if (!String(file.type || "").startsWith("image/")) {
    sendJson(res, 400, { error: "이미지 파일만 업로드할 수 있습니다." });
    return;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > maxUploadSize) {
    sendJson(res, 413, { error: "이미지 파일은 8MB 이하만 가능합니다." });
    return;
  }

  const originalExt = path.extname(file.name || "").toLowerCase();
  const allowedExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);
  const mimeExt = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
  };
  const ext = allowedExts.has(originalExt) ? originalExt : mimeExt[file.type] || ".jpg";
  const filename = `${Date.now()}-${randomBytes(5).toString("hex")}${ext}`;
  const targetDir = path.join(uploadDir, category, bucket);
  const targetFile = path.join(targetDir, filename);

  await ensureDir(targetDir);
  await writeFile(targetFile, buffer);

  sendJson(res, 201, {
    path: `/uploads/${encodeURIComponent(category)}/${encodeURIComponent(bucket)}/${encodeURIComponent(filename)}`,
  });
};

const safeResolve = (baseDir, requestPath) => {
  const resolved = path.resolve(baseDir, requestPath);
  const base = path.resolve(baseDir);
  const normalizedResolved = resolved.toLowerCase();
  const normalizedBase = base.toLowerCase();
  if (normalizedResolved !== normalizedBase && !normalizedResolved.startsWith(`${normalizedBase}${path.sep}`)) {
    return null;
  }
  return resolved;
};

const staticCandidates = (pathname) => {
  const candidates = [];

  if (/^\/members\/[^/]+\/?$/.test(pathname)) {
    candidates.push(path.join(distDir, "members", "index.html"));
    return candidates;
  }

  if (pathname === "/admin") {
    candidates.push(path.join(distDir, "admin", "index.html"));
    return candidates;
  }

  const cleanPath = pathname === "/" ? "/index.html" : pathname;

  if (cleanPath.startsWith("/uploads/")) {
    const uploadPath = safeResolve(uploadDir, cleanPath.slice("/uploads/".length));
    if (uploadPath) {
      candidates.push(uploadPath);
    }
    return candidates;
  }

  const directPath = safeResolve(distDir, cleanPath.slice(1));
  if (directPath) {
    candidates.push(directPath);
  }

  if (path.extname(cleanPath) === "") {
    const indexPath = safeResolve(distDir, path.join(cleanPath.slice(1), "index.html"));
    if (indexPath) {
      candidates.push(indexPath);
    }
  }

  return candidates;
};

const normalizeVisitRoute = (pathname) => {
  let route = pathname || "/";
  if (route.endsWith("/index.html")) {
    route = route.slice(0, -"/index.html".length) || "/";
  }
  if (route.endsWith(".html")) {
    route = route.slice(0, -".html".length) || "/";
  }
  if (route.length > 1 && route.endsWith("/")) {
    route = route.slice(0, -1);
  }
  return route || "/";
};

const shouldCountPageView = (req, pathname, candidate) => {
  if (req.method !== "GET" || path.extname(candidate).toLowerCase() !== ".html") {
    return false;
  }

  const route = normalizeVisitRoute(pathname);
  return route !== "/admin" && !route.startsWith("/admin/");
};

const recordPageView = (pathname) => {
  const route = normalizeVisitRoute(pathname);
  visitWriteQueue = visitWriteQueue
    .catch(() => {})
    .then(async () => {
      const visits = await readVisits();
      const day = visitDayKey();
      visits.total += 1;
      visits.pages[route] = (visits.pages[route] || 0) + 1;
      visits.days[day] = visits.days[day] || { total: 0, pages: {} };
      visits.days[day].total += 1;
      visits.days[day].pages[route] = (visits.days[day].pages[route] || 0) + 1;
      visits.updatedAt = new Date().toISOString();
      await writeVisits(visits);
    });
  visitWriteQueue.catch((error) => console.error("방문자 수 저장 실패:", error));
};

const serveStatic = async (req, res, url) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendText(res, 400, "Bad request");
    return;
  }

  const legacyYear = pathname.match(/^\/members(20\d{2})\/?$/);
  if (legacyYear) {
    redirect(res, `/members/${legacyYear[1]}`);
    return;
  }
  if (/^\/membersArchive\/?$/.test(pathname)) {
    redirect(res, "/members/archive");
    return;
  }
  if (/^\/membersOB\/?$/.test(pathname)) {
    redirect(res, "/members/ob");
    return;
  }

  for (const candidate of staticCandidates(pathname)) {
    try {
      const info = await stat(candidate);
      if (!info.isFile()) {
        continue;
      }

      const ext = path.extname(candidate).toLowerCase();
      res.writeHead(200, {
        "content-type": mimeTypes.get(ext) || "application/octet-stream",
      });
      if (shouldCountPageView(req, pathname, candidate)) {
        recordPageView(pathname);
      }
      createReadStream(candidate).pipe(res);
      return;
    } catch {
      // Try next candidate.
    }
  }

  sendText(res, 404, "Not found");
};

const handleApi = async (req, res, url) => {
  if (req.method === "GET" && url.pathname === "/api/home") {
    sendJson(res, 200, await readHome());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/home-en") {
    sendJson(res, 200, await readHomeEn());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/intro") {
    sendJson(res, 200, await readIntro());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/intro-en") {
    sendJson(res, 200, await readIntroEn());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/history") {
    sendJson(res, 200, await readHistory());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/members") {
    sendJson(res, 200, await readMembers());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/sponsors") {
    sendJson(res, 200, await readSponsors());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/contact") {
    sendJson(res, 200, await readContact());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/session") {
    sendJson(res, 200, { authenticated: isAuthenticated(req) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/pages") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    sendJson(res, 200, await readSitePages());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/visits") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    sendJson(res, 200, await readVisits());
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const body = await readJsonBody(req);
    if (!(await authenticateAdminPassword(body.password || ""))) {
      sendJson(res, 401, { error: "비밀번호가 올바르지 않습니다." });
      return true;
    }

    const token = createSessionToken();
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 7}`,
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/change-password") {
    if (!requireAdmin(req, res)) {
      return true;
    }

    const body = await readJsonBody(req);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!(await authenticateAdminPassword(currentPassword))) {
      sendJson(res, 401, { error: "현재 비밀번호가 올바르지 않습니다." });
      return true;
    }

    if (newPassword.length < minPasswordLength) {
      sendJson(res, 400, { error: `새 비밀번호는 ${minPasswordLength}자 이상이어야 합니다.` });
      return true;
    }

    await updateAdminPassword(newPassword);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      "cache-control": "no-store",
    });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/members") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeMembers(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/home") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeHome(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/home-en") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeHomeEn(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/intro") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeIntro(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/intro-en") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeIntroEn(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/history") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeHistory(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/sponsors") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeSponsors(body));
    return true;
  }

  if (req.method === "PUT" && url.pathname === "/api/admin/contact") {
    if (!requireAdmin(req, res)) {
      return true;
    }
    const body = await readJsonBody(req);
    sendJson(res, 200, await writeContact(body));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/upload") {
    await uploadImage(req, res);
    return true;
  }

  return false;
};

const handleRequest = async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, url);
    if (!handled) {
      sendJson(res, 404, { error: "API를 찾을 수 없습니다." });
    }
    return;
  }

  await serveStatic(req, res, url);
};

await ensureDir(dataDir);
await ensureDir(uploadDir);

if (!(await fileExists(authFile)) && !process.env.TACHYON_ADMIN_PASSWORD) {
  console.warn("TACHYON_ADMIN_PASSWORD가 없어 초기 관리자 비밀번호로 dev-password를 사용합니다. /admin에서 바로 변경하세요.");
}

createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "서버 오류가 발생했습니다." });
    } else {
      res.end();
    }
  });
}).listen(port, () => {
  console.log(`Tachyon site server listening on http://localhost:${port}`);
});
