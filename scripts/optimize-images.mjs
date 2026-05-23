import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const publicImagesDir = path.join(rootDir, "public", "images");
const uploadDir = path.join(rootDir, "uploads");
const backupDir = path.join(
  rootDir,
  "backups",
  `image-opt-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);

const sourceRoots = ["data", "src"];
const maxImageWidth = 1600;
const jpegQuality = 78;
const webpQuality = 78;
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".svg"]);
const editableExtensions = new Set([".json", ".astro", ".js", ".mjs", ".ts", ".css", ".html"]);
const skipOptimizeExtensions = new Set([".svg", ".gif", ".bmp"]);

const slash = (value) => value.split(path.sep).join("/");

const listFiles = async (dir) => {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
};

const publicRef = (filePath) => {
  const relative = slash(path.relative(rootDir, filePath));
  if (relative.startsWith("public/images/")) {
    return `/${relative.slice("public/".length)}`;
  }
  if (relative.startsWith("uploads/")) {
    return `/${relative}`;
  }
  return "";
};

const hashFile = async (filePath) => createHash("sha256").update(await readFile(filePath)).digest("hex");

const sourceFiles = async () => {
  const roots = sourceRoots.map((item) => path.join(rootDir, item));
  const files = (await Promise.all(roots.map(listFiles))).flat();
  return files.filter((filePath) => editableExtensions.has(path.extname(filePath).toLowerCase()));
};

const readSources = async () => {
  const files = await sourceFiles();
  const sources = new Map();
  await Promise.all(files.map(async (filePath) => sources.set(filePath, await readFile(filePath, "utf8"))));
  return sources;
};

const refCount = (sources, ref) => {
  let count = 0;
  for (const text of sources.values()) {
    let index = text.indexOf(ref);
    while (index !== -1) {
      count += 1;
      index = text.indexOf(ref, index + ref.length);
    }
  }
  return count;
};

const canonicalScore = (filePath, sources) => {
  const ref = publicRef(filePath);
  const normalized = slash(path.relative(rootDir, filePath));
  let score = 0;

  if (refCount(sources, ref) === 0) score += 1000;
  if (normalized.includes("vehicles copy/")) score += 500;
  if (normalized.includes("banner-dark.")) score += 80;
  if (normalized.includes("/photo/")) score += 40;
  if (normalized.includes("/profile/")) score += 30;
  if (normalized.includes("/vehicles/")) score += 10;
  score += normalized.length / 1000;

  return score;
};

const replaceRefs = async (replacements) => {
  if (!replacements.size) {
    return 0;
  }

  const files = await sourceFiles();
  let changed = 0;
  for (const filePath of files) {
    let text = await readFile(filePath, "utf8");
    const original = text;
    for (const [from, to] of replacements) {
      text = text.split(from).join(to);
    }
    if (text !== original) {
      await writeFile(filePath, text, "utf8");
      changed += 1;
    }
  }
  return changed;
};

const removeEmptyDirs = async (dir) => {
  if (!existsSync(dir)) {
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => removeEmptyDirs(path.join(dir, entry.name))));

  const after = await readdir(dir);
  if (after.length === 0 && dir !== publicImagesDir && dir !== uploadDir) {
    await rm(dir, { recursive: true, force: true });
  }
};

const shouldConvertToJpeg = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".bmp") {
    return false;
  }
  if (ext !== ".png") {
    return false;
  }

  const info = await stat(filePath);
  if (info.size < 800 * 1024) {
    return false;
  }

  const metadata = await sharp(filePath).metadata();
  return !metadata.hasAlpha;
};

const convertToJpeg = async (filePath) => {
  const targetPath = filePath.replace(/\.[^.]+$/, ".jpg");
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  await sharp(filePath)
    .rotate()
    .resize({ width: maxImageWidth, withoutEnlargement: true })
    .jpeg({ quality: jpegQuality, progressive: true, mozjpeg: true })
    .toFile(tempPath);
  await rename(tempPath, targetPath);
  await rm(filePath, { force: true });
  return targetPath;
};

const optimizeInPlace = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (skipOptimizeExtensions.has(ext)) {
    return { outputPath: filePath, before: (await stat(filePath)).size, after: (await stat(filePath)).size };
  }

  const before = (await stat(filePath)).size;
  const tempPath = `${filePath}.${process.pid}.tmp`;
  let pipeline = sharp(filePath).rotate().resize({ width: maxImageWidth, withoutEnlargement: true });

  if (ext === ".jpg" || ext === ".jpeg") {
    pipeline = pipeline.jpeg({ quality: jpegQuality, progressive: true, mozjpeg: true });
  } else if (ext === ".png") {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true });
  } else if (ext === ".webp") {
    pipeline = pipeline.webp({ quality: webpQuality, effort: 5 });
  } else {
    return { outputPath: filePath, before, after: before };
  }

  await pipeline.toFile(tempPath);
  const after = (await stat(tempPath)).size;
  if (after < before) {
    await rename(tempPath, filePath);
    return { outputPath: filePath, before, after };
  }

  await rm(tempPath, { force: true });
  return { outputPath: filePath, before, after: before };
};

const validateRefs = async () => {
  const dataFiles = (await listFiles(path.join(rootDir, "data"))).filter((filePath) => path.extname(filePath) === ".json");
  const missing = [];

  const collectRefs = (value, refs = []) => {
    if (Array.isArray(value)) {
      value.forEach((item) => collectRefs(item, refs));
    } else if (value && typeof value === "object") {
      Object.values(value).forEach((item) => collectRefs(item, refs));
    } else if (typeof value === "string" && (value.startsWith("/images/") || value.startsWith("/uploads/"))) {
      refs.push(value);
    }
    return refs;
  };

  const checkRef = (filePath, ref) => {
    const target = ref.startsWith("/images/")
      ? path.join(rootDir, "public", ref.slice(1))
      : path.join(rootDir, ref.slice(1));
    if (!existsSync(target)) {
      missing.push(`${slash(path.relative(rootDir, filePath))}: ${ref}`);
    }
  };

  for (const filePath of dataFiles) {
    const data = JSON.parse(await readFile(filePath, "utf8"));
    for (const ref of collectRefs(data)) {
      checkRef(filePath, ref);
    }
  }

  const quotedAssetPattern = /\b(?:src|href|srcset)=["'](\/(?:images|uploads)\/[^"']+)["']/g;
  for (const filePath of await sourceFiles()) {
    if (slash(path.relative(rootDir, filePath)).startsWith("data/")) {
      continue;
    }
    const text = await readFile(filePath, "utf8");
    for (const match of text.matchAll(quotedAssetPattern)) {
      for (const ref of match[1].split(",").map((item) => item.trim().split(/\s+/)[0])) {
        checkRef(filePath, ref);
      }
    }
  }

  return missing;
};

await mkdir(backupDir, { recursive: true });
if (existsSync(publicImagesDir)) {
  await cp(publicImagesDir, path.join(backupDir, "public", "images"), { recursive: true });
}
if (existsSync(uploadDir)) {
  await cp(uploadDir, path.join(backupDir, "uploads"), { recursive: true });
}

const allImageFiles = async () =>
  (await Promise.all([listFiles(publicImagesDir), listFiles(uploadDir)]))
    .flat()
    .filter((filePath) => imageExtensions.has(path.extname(filePath).toLowerCase()));

const sources = await readSources();
const files = await allImageFiles();
const byHash = new Map();
for (const filePath of files) {
  const hash = await hashFile(filePath);
  byHash.set(hash, [...(byHash.get(hash) || []), filePath]);
}

const replacements = new Map();
const duplicateDeletes = [];
for (const group of byHash.values()) {
  if (group.length < 2) {
    continue;
  }

  const [keep, ...remove] = [...group].sort((left, right) => canonicalScore(left, sources) - canonicalScore(right, sources));
  for (const filePath of remove) {
    const from = publicRef(filePath);
    const to = publicRef(keep);
    if (from && to && from !== to) {
      replacements.set(from, to);
    }
    duplicateDeletes.push(filePath);
  }
}

let changedSourceFiles = await replaceRefs(replacements);
for (const filePath of duplicateDeletes) {
  await rm(filePath, { force: true });
}
await removeEmptyDirs(publicImagesDir);
await removeEmptyDirs(uploadDir);

const conversionReplacements = new Map();
let converted = 0;
let optimized = 0;
let beforeTotal = 0;
let afterTotal = 0;

for (const filePath of await allImageFiles()) {
  let targetPath = filePath;
  if (await shouldConvertToJpeg(filePath)) {
    const beforeRef = publicRef(filePath);
    targetPath = await convertToJpeg(filePath);
    const afterRef = publicRef(targetPath);
    if (beforeRef && afterRef && beforeRef !== afterRef) {
      conversionReplacements.set(beforeRef, afterRef);
    }
    converted += 1;
  }

  const result = await optimizeInPlace(targetPath);
  beforeTotal += result.before;
  afterTotal += result.after;
  if (result.after < result.before) {
    optimized += 1;
  }
}

changedSourceFiles += await replaceRefs(conversionReplacements);

const missing = await validateRefs();
if (missing.length) {
  throw new Error(`Missing image references:\n${missing.join("\n")}`);
}

const imageFilesAfter = await allImageFiles();
const totalAfter = (
  await Promise.all(imageFilesAfter.map(async (filePath) => (await stat(filePath)).size))
).reduce((sum, size) => sum + size, 0);

console.log(JSON.stringify(
  {
    backup: slash(path.relative(rootDir, backupDir)),
    duplicatesRemoved: duplicateDeletes.length,
    refsUpdated: replacements.size + conversionReplacements.size,
    changedSourceFiles,
    converted,
    optimized,
    optimizedBytesBefore: beforeTotal,
    optimizedBytesAfter: afterTotal,
    imageCountAfter: imageFilesAfter.length,
    totalBytesAfter: totalAfter,
  },
  null,
  2,
));
