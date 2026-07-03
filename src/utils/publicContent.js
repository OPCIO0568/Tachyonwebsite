const galleryColumnCount = 3;
const fallbackPhoto = "/images/profile/unprofile.jpg";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeHref = (value) => {
  const href = String(value || "").trim();
  if (!href) {
    return "#";
  }
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return href;
  }

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : "#";
  } catch {
    return "#";
  }
};

const normalizeGridRows = (value) => Math.max(1, Math.min(24, Number(value) || 6));

const blockCells = (value) => {
  if (String(value) === "2v") {
    return [0, 3];
  }

  const blocks = Number(value) || 1;
  if (blocks === 2) {
    return [0, 1];
  }
  if (blocks === 4) {
    return [0, 1, 3, 4];
  }
  if (blocks === 6) {
    return [0, 1, 2, 3, 4, 5];
  }
  return [0];
};

const normalizeCells = (cells, gridRows, fallbackBlocks = 1) => {
  const maxCells = normalizeGridRows(gridRows) * galleryColumnCount;
  const source = Array.isArray(cells) && cells.length ? cells : blockCells(fallbackBlocks);
  const uniqueCells = [
    ...new Set(
      source
        .map((cell) => Number(cell))
        .filter((cell) => Number.isInteger(cell) && cell >= 0 && cell < maxCells),
    ),
  ];

  if (!uniqueCells.length) {
    return [0];
  }

  const rows = uniqueCells.map((cell) => Math.floor(cell / galleryColumnCount));
  const columns = uniqueCells.map((cell) => cell % galleryColumnCount);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  const rectCells = [];

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const cell = row * galleryColumnCount + column;
      if (cell < maxCells) {
        rectCells.push(cell);
      }
    }
  }

  return rectCells;
};

const legacyGalleryItems = (data) => {
  if (Array.isArray(data?.items)) {
    return data.items;
  }

  let rowOffset = 0;
  return (Array.isArray(data?.rows) ? data.rows : []).flatMap((row) => {
    const rowGridRows = normalizeGridRows(row.gridRows || 2);
    const items = (row.items ?? []).map((item) => ({
      ...item,
      cells: normalizeCells(item.cells, rowGridRows, item.blocks).map((cell) => cell + rowOffset * galleryColumnCount),
    }));
    rowOffset += rowGridRows;
    return items;
  });
};

const galleryItemStyle = (item, gridRows) => {
  const cells = normalizeCells(item.cells, gridRows, item.blocks || item.size);
  const rows = cells.map((cell) => Math.floor(cell / galleryColumnCount));
  const columns = cells.map((cell) => cell % galleryColumnCount);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  return `grid-column: ${minColumn + 1} / span ${maxColumn - minColumn + 1}; grid-row: ${minRow + 1} / span ${maxRow - minRow + 1};`;
};

const youtubeIdFromUrl = (value) => {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }

  try {
    const url = new URL(source);
    const hostname = url.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || "";
    }
    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const directId = url.searchParams.get("v");
      if (directId) {
        return directId;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if ((parts[0] === "embed" || parts[0] === "shorts") && parts[1]) {
        return parts[1];
      }
    }
  } catch {
    return "";
  }

  return "";
};

const youtubeEmbedUrl = (value) => {
  const id = youtubeIdFromUrl(value);
  return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : "";
};

export const normalizeGallery = (data) => ({
  title: data?.title || "Gallery",
  description: data?.description || "",
  gridRows: normalizeGridRows(data?.gridRows || 6),
  items: legacyGalleryItems(data).map((item) => {
    const size = Number(item?.size) || Number(item?.blocks) || 1;
    const source = String(item?.image || "");
    const isYoutube = item?.mediaType === "youtube" || Boolean(youtubeEmbedUrl(source));
    const isVideo = item?.mediaType === "video" || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(source);
    return {
      ...item,
      mediaType: size === 6 && isYoutube ? "youtube" : isVideo && size === 6 ? "video" : "image",
    };
  }),
});

export const renderGallery = (data) => {
  const gallery = normalizeGallery(data);
  const items = gallery.items.filter((item) => item.image && item.placed !== false);

  return `
    <h1 class="section-title">${escapeHtml(gallery.title)}</h1>
    <p class="section-subtitle">${escapeHtml(gallery.description)}</p>
    ${
      items.length
        ? `<div class="gallery-grid" style="--gallery-rows: ${gallery.gridRows};">${items
            .map(
              (item) => `
                <figure class="gallery-item" style="${galleryItemStyle(item, gallery.gridRows)}">
                  ${
                    item.mediaType === "youtube"
                      ? `<iframe src="${escapeHtml(youtubeEmbedUrl(item.image))}" title="${escapeHtml(item.alt || item.title || "Tachyon gallery video")}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
                      : item.mediaType === "video"
                      ? `<video src="${escapeHtml(item.image)}" controls playsinline preload="metadata" aria-label="${escapeHtml(item.alt || item.title || "Tachyon gallery video")}"></video>`
                      : `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title || "Tachyon gallery photo")}" loading="lazy">`
                  }
                </figure>
              `,
            )
            .join("")}</div>`
        : '<p class="admin-empty">등록된 갤러리 사진이 없습니다.</p>'
    }
  `;
};

export const normalizeHome = (data) => ({
  title: data?.title || "Tachyon",
  description: data?.description || "",
  hero: {
    lightImage: data?.hero?.lightImage || "",
    darkImage: data?.hero?.darkImage || "",
    alt: data?.hero?.alt || "Tachyon Banner",
    title: data?.hero?.title || "",
    lead: data?.hero?.lead || "",
  },
  cards: Array.isArray(data?.cards) ? data.cards : [],
  contact: {
    title: data?.contact?.title || "With US",
    photos: Array.isArray(data?.contact?.photos) ? data.contact.photos : [],
    links: Array.isArray(data?.contact?.links) ? data.contact.links : [],
  },
});

export const renderHome = (data) => {
  const home = normalizeHome(data);
  const darkSource = home.hero.darkImage
    ? `<source srcset="${escapeHtml(home.hero.darkImage)}" media="(prefers-color-scheme: dark)">`
    : "";

  return `
    <section class="hero">
      <picture>
        ${darkSource}
        <img src="${escapeHtml(home.hero.lightImage)}" alt="${escapeHtml(home.hero.alt)}">
      </picture>
      <div class="container hero-content">
        <h1 class="hero-title">${escapeHtml(home.hero.title)}</h1>
        <p class="hero-lead">${escapeHtml(home.hero.lead)}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2 class="section-title"></h2>
        <div class="card-grid">
          ${home.cards
            .map(
              (card) => `
                <a class="card" href="${escapeHtml(safeHref(card.href))}">
                  <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.alt || card.label)}">
                  <span class="label">${escapeHtml(card.label)}</span>
                </a>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>

    <section class="section" id="contact">
      <div class="container">
        <h2 class="section-title">${escapeHtml(home.contact.title)}</h2>
        <div class="contact-grid">
          ${home.contact.photos
            .map(
              (photo) => `
                <div class="contact-panel">
                  <a class="contact-photo-link" href="${escapeHtml(safeHref(photo.href))}">
                    <img class="contact-photo" src="${escapeHtml(photo.image)}" alt="${escapeHtml(photo.alt)}">
                  </a>
                </div>
              `,
            )
            .join("")}
          <div class="contact-panel contact-buttons">
            ${home.contact.links
              .map((link) => `<a class="contact-btn" href="${escapeHtml(safeHref(link.href))}">${escapeHtml(link.label)}</a>`)
              .join("")}
          </div>
        </div>
      </div>
    </section>
  `;
};

export const normalizeIntro = (data) => ({
  title: data?.title || "About Us",
  description: data?.description || "",
  sections: Array.isArray(data?.sections) ? data.sections : [],
  organization: {
    title: data?.organization?.title || "Organization",
    image: data?.organization?.image || "",
    alt: data?.organization?.alt || "Team Organization Chart",
  },
});

const paragraphHtml = (text) => {
  const value = String(text || "").trim();
  if (/^https?:\/\//.test(value)) {
    return `<p><a href="${escapeHtml(safeHref(value))}">${escapeHtml(value)}</a></p>`;
  }
  return `<p>${escapeHtml(value)}</p>`;
};

export const renderIntro = (data) => {
  const intro = normalizeIntro(data);
  const sections = intro.sections
    .map((section, index) => {
      const titleTag = index === 0 ? "h1" : "h2";
      return `
        <section class="section">
          <div class="container">
            <${titleTag} class="section-title">${escapeHtml(section.heading)}</${titleTag}>
            ${(section.paragraphs || []).map(paragraphHtml).join("")}
          </div>
        </section>
      `;
    })
    .join("");
  const organization = intro.organization.image
    ? `
      <section class="section">
        <div class="container">
          <h2 class="section-title">${escapeHtml(intro.organization.title)}</h2>
          <div class="org-chart">
            <img src="${escapeHtml(intro.organization.image)}" alt="${escapeHtml(intro.organization.alt)}">
          </div>
        </div>
      </section>
    `
    : "";

  return `${sections}${organization}`;
};

export const normalizeHistory = (data) => ({
  title: data?.title || "Our Cars",
  description: data?.description || "",
  vehicleSectionTitle: data?.vehicleSectionTitle || "History",
  groups: Array.isArray(data?.groups) ? data.groups : [],
  awards: {
    title: data?.awards?.title || "Awards",
    items: Array.isArray(data?.awards?.items) ? data.awards.items : [],
  },
});

const renderVehicleCard = (vehicle) => `
  <article class="history-card">
    ${vehicle.image ? `<img src="${escapeHtml(vehicle.image)}" alt="${escapeHtml(vehicle.alt || vehicle.name)}">` : ""}
    <div class="history-card-body">
      <h4 class="history-card-title">${escapeHtml(vehicle.name)}</h4>
      ${vehicle.year ? `<p class="history-card-year">제작: ${escapeHtml(vehicle.year)}</p>` : ""}
      ${vehicle.competition ? `<p class="history-card-result">참여 대회: ${escapeHtml(vehicle.competition)}</p>` : ""}
      ${vehicle.award ? `<p class="history-card-result">수상: ${escapeHtml(vehicle.award)}</p>` : ""}
    </div>
  </article>
`;

export const renderHistoryMain = (data) => {
  const history = normalizeHistory(data);
  return `
    <h2 class="section-title">${escapeHtml(history.vehicleSectionTitle)}</h2>
    ${history.groups
      .map(
        (group) => `
          <div class="history-group">
            <h3 class="history-group-title">${escapeHtml(group.title)}</h3>
            <div class="history-cards">${(group.vehicles || []).map(renderVehicleCard).join("")}</div>
          </div>
        `,
      )
      .join("")}
  `;
};

export const renderHistoryAwards = (data) => {
  const history = normalizeHistory(data);
  return `
    <h2 class="section-title">${escapeHtml(history.awards.title)}</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Competition</th>
            <th>Vehicle</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${history.awards.items
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.year)}</td>
                  <td>${escapeHtml(item.competition)}</td>
                  <td>${escapeHtml(item.vehicle)}</td>
                  <td>${escapeHtml(item.result)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

export const normalizeSponsors = (data) => ({
  title: data?.title || "Sponsors",
  description: data?.description || "",
  heroImage: data?.heroImage || "",
  items: Array.isArray(data?.items) ? data.items : [],
});

export const renderSponsors = (data) => {
  const sponsors = normalizeSponsors(data);
  return `
    <h1 class="section-title">${escapeHtml(sponsors.title)}</h1>
    <p>${escapeHtml(sponsors.description)}</p>
    ${
      sponsors.heroImage
        ? `
          <div class="sponsors-hero">
            <img src="${escapeHtml(sponsors.heroImage)}" alt="Sponsors">
          </div>
        `
        : ""
    }
    <div class="logo-grid">
      ${sponsors.items
        .map((sponsor) => {
          const hasLogo = Boolean(sponsor.logo);
          return `
            <a class="${hasLogo ? "logo-card has-image" : "logo-card no-image"}" href="${escapeHtml(safeHref(sponsor.url))}">
              ${hasLogo ? `<img src="${escapeHtml(sponsor.logo)}" alt="${escapeHtml(sponsor.name)}">` : ""}
              <span class="logo-name">${escapeHtml(sponsor.name)}</span>
            </a>
          `;
        })
        .join("")}
    </div>
  `;
};

export const normalizeContact = (data) => ({
  title: data?.title || "Contact Us",
  subtitle: data?.subtitle || "",
  heroImage: data?.heroImage || "",
  serverAdmin: {
    role: data?.serverAdmin?.role || "Server Admin",
    name: data?.serverAdmin?.name || "",
    email: data?.serverAdmin?.email || "",
  },
  contacts: Array.isArray(data?.contacts) ? data.contacts : [],
  socials: Array.isArray(data?.socials) ? data.socials : [],
});

export const renderContact = (data) => {
  const contact = normalizeContact(data);
  const serverAdmin =
    contact.serverAdmin.name || contact.serverAdmin.email
      ? `
        <div class="contact-server-admin">
          <span>${escapeHtml(contact.serverAdmin.role || "Server Admin")}</span>
          ${contact.serverAdmin.name ? `<span>${escapeHtml(contact.serverAdmin.name)}</span>` : ""}
          ${contact.serverAdmin.email ? `<a href="mailto:${escapeHtml(contact.serverAdmin.email)}">${escapeHtml(contact.serverAdmin.email)}</a>` : ""}
        </div>
      `
      : "";

  return `
    <h1 class="section-title">${escapeHtml(contact.title)}</h1>
    ${contact.subtitle ? `<p class="section-subtitle">${escapeHtml(contact.subtitle)}</p>` : ""}
    ${
      contact.heroImage
        ? `
          <div class="contact-hero">
            <img src="${escapeHtml(contact.heroImage)}" alt="Tachyon Team">
          </div>
        `
        : ""
    }
    <div class="contact-info-grid">
      ${contact.contacts
        .map(
          (item) => `
            <div class="contact-info-card">
              <h3>${escapeHtml(item.role)}</h3>
              <p class="contact-info-name">${escapeHtml(item.name)}</p>
              ${item.phone ? `<p class="contact-info-detail">${escapeHtml(item.phone)}</p>` : ""}
              ${item.email ? `<p class="contact-info-detail"><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></p>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
    <div class="contact-social-grid">
      ${contact.socials
        .map(
          (social) => `
            <a class="contact-social-card" href="${escapeHtml(safeHref(social.url))}">
              ${social.image ? `<img src="${escapeHtml(social.image)}" alt="${escapeHtml(social.name)}">` : ""}
              <span>${escapeHtml(social.name)}</span>
            </a>
          `,
        )
        .join("")}
    </div>
    ${serverAdmin}
  `;
};

const sortSeasons = (seasons) => [...(seasons ?? [])].sort((a, b) => Number(b.year) - Number(a.year));

export const defaultMembersView = (data) => ({
  type: "season",
  year: sortSeasons(data?.seasons)[0]?.year,
});

const renderMemberTabs = (data, active) => {
  const seasonTabs = sortSeasons(data.seasons)
    .map((season) => {
      const activeClass = active.type === "season" && active.year === season.year ? " is-active" : "";
      return `<button class="member-tab${activeClass}" type="button" data-year="${escapeHtml(season.year)}">${escapeHtml(season.year)}</button>`;
    })
    .join("");

  return `
    <div class="member-tabs" role="tablist">
      ${seasonTabs}
      <button class="member-tab${active.type === "archive" ? " is-active" : ""}" type="button" data-view="archive">Archive</button>
      <button class="member-tab${active.type === "ob" ? " is-active" : ""}" type="button" data-view="ob">OB</button>
    </div>
  `;
};

const renderTeamPhotos = (photos, alt) =>
  photos?.length
    ? photos
        .map(
          (photo) => `
            <div class="member-hero">
              <img class="member-hero-photo" src="${escapeHtml(photo)}" alt="${escapeHtml(alt)}">
            </div>
          `,
        )
        .join("")
    : "";

const renderMember = (member) => {
  const email = String(member.email ?? "").trim();
  return `
    <article class="member-card">
      <img class="member-photo" src="${escapeHtml(member.photo || fallbackPhoto)}" alt="${escapeHtml(member.name || member.role || "Member")}">
      <h3 class="member-name">${escapeHtml(member.name || "이름 입력")}</h3>
      <p class="member-role">${escapeHtml(member.role || "")}</p>
      ${
        email
          ? `<button class="member-link member-email-copy" type="button" data-email="${escapeHtml(email)}" aria-label="${escapeHtml(`${email} copy`)}">Email</button>`
          : ""
      }
    </article>
  `;
};

const renderMemberSections = (sections) =>
  sections?.length
    ? sections
        .map(
          (section) => `
            <div class="member-section">
              <h2 class="member-section-title">${escapeHtml(section.title)}</h2>
              ${(section.groups ?? [])
                .map(
                  (group) => `
                    ${group.title ? `<h3 class="member-subtitle">${escapeHtml(group.title)}</h3>` : ""}
                    <div class="member-grid">${(group.members ?? []).map(renderMember).join("")}</div>
                  `,
                )
                .join("")}
            </div>
          `,
        )
        .join("")
    : "";

export const renderMembers = (data, view = defaultMembersView(data)) => {
  if (view.type === "archive") {
    const groups = data.archive?.groups ?? [];
    return `
      <h1 class="section-title">${escapeHtml(data.archive?.title || "Members Archive")}</h1>
      <p class="section-subtitle">${escapeHtml(data.archive?.subtitle || "")}</p>
      ${renderMemberTabs(data, { type: "archive" })}
      ${groups
        .map(
          (group) => `
            <h2 class="member-section-title">${escapeHtml(group.label)}</h2>
            ${renderTeamPhotos(group.photos, `Tachyon Team ${group.label}`)}
          `,
        )
        .join("")}
    `;
  }

  if (view.type === "ob") {
    return `
      <h1 class="section-title">${escapeHtml(data.ob?.title || "OB Members")}</h1>
      <p class="section-subtitle">${escapeHtml(data.ob?.subtitle || "")}</p>
      ${renderMemberTabs(data, { type: "ob" })}
      ${renderTeamPhotos(data.ob?.teamPhotos, "Tachyon OB Team")}
      <div class="member-grid">${(data.ob?.members ?? []).map(renderMember).join("")}</div>
    `;
  }

  const season = data.seasons?.find((item) => item.year === view.year) ?? sortSeasons(data.seasons)[0];
  if (!season) {
    return `
      <h1 class="section-title">Members</h1>
      <p class="section-subtitle">등록된 시즌이 없습니다.</p>
    `;
  }

  return `
    <h1 class="section-title">${escapeHtml(season.title || `Members ${season.year}`)}</h1>
    <p class="section-subtitle">${escapeHtml(season.subtitle || "")}</p>
    ${renderMemberTabs(data, { type: "season", year: season.year })}
    ${renderTeamPhotos(season.teamPhotos, `Tachyon Team ${season.year}`)}
    ${renderMemberSections(season.sections)}
  `;
};
