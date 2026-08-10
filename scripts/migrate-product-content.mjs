// ─────────────────────────────────────────────────────────────────────────────
// One-time migration: OLD linea.hr product copy → the NEW product content model
// (core #194 — per-locale `description` + `detailTabs`).
//
// The 2020 site (linea.hr) is the source of truth for product copy. The commerce
// migration (migrate-products-to-commerce.mjs) carried that copy over as a
// Mixed Content body, which lost the tab structure and, for some products, whole
// tabs. This script re-reads each product page on linea.hr and writes the copy
// back as FIRST-CLASS fields:
//
//   description  ← the "Opis proizvoda" block, as plain text (blank line = ¶)
//   detailTabs[] ← one entry per legacy tab: { id, title, content: TipTapDoc }
//
// Legacy body images are downloaded from linea.hr and re-uploaded into the CMS
// media library (folder "Proizvodi" → per-product subfolder, or "Zajedničko" for
// an image used by more than one product), renamed to readable kebab-case names.
// The uploaded CDN url is what lands in the content — nothing hotlinks linea.hr.
//
// PHASES (each writes to the work dir so a run can be resumed / inspected):
//   scrape  → crawl linea.hr, parse, convert          → old-content.json
//   images  → download + upload every referenced image → image-map.json
//   apply   → PUT the content onto the CMS + publish   → apply-report.json
//   all     → scrape → images → apply
//
// USAGE (run from the project root):
//   # against local dev
//   node scripts/migrate-product-content.mjs all \
//     --api=http://localhost:3001 --email=… --password=… --dry-run
//
//   # against production (after the core #194 branches are merged + deployed)
//   node scripts/migrate-product-content.mjs all \
//     --api=https://cms5.artkod.opalstacked.com --email=… --password=…
//
// FLAGS
//   --api=URL           CMS API base                       (required for images/apply)
//   --email / --password  CMS admin login (developer/owner/shop role)
//   --project=slug      X-Project-Slug                     (default: linea)
//   --locale=hr         which product locale to write       (default: hr)
//   --only=slug[,slug]  restrict to these product slugs
//   --work=DIR          work dir                            (default: .migration)
//   --dry-run           parse/convert + report, write NOTHING to the CMS
//   --force             overwrite products that already carry detailTabs
//
// SAFETY
//   • Only `translations[locale].description` / `.detailTabs` / `.blocks` change;
//     name, SEO, gallery, variants, prices, categories are read and written back
//     untouched (a full-translations PUT is the API's only shape).
//   • An ACTIVE product stages content into a draft, so every write is followed
//     by POST /products/:id/publish — otherwise nothing goes live.
//   • Re-runnable: images dedupe by content hash, products skip when already
//     migrated unless --force.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { htmlToTiptap, htmlToPlainDescription, parseHtml, plainText } from "./lib/legacy-html.mjs";

const OLD_ORIGIN = "https://linea.hr";
const OLD_SITEMAP = `${OLD_ORIGIN}/sitemap.xml`;

// OLD slug → NEW slug, where the two catalogs diverged (renames + splits).
// Verified by hand against both catalogs; anything not listed matches by slug,
// then by normalised name.
// OLD slug → NEW slug, for products the two catalogs named differently. Empty
// today: the crawl reaches every live OLD page under its own slug, and same-slug
// products in different categories are separated by the category matcher below
// (the sitemap's stale /ravni-pop-up, /3x3 … entries are 404s, not renames).
const SLUG_OVERRIDES = {};

// NEW products the OLD site has no page for — reported, never touched.
const KNOWN_NEW_ONLY = [];

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const phase = argv.find((a) => !a.startsWith("--")) ?? "all";
const flag = (name, dflt = null) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return dflt;
  return hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const API = String(flag("api", "http://localhost:3001")).replace(/\/$/, "");
const PROJECT = String(flag("project", "linea"));
const LOCALE = String(flag("locale", "hr"));
const WORK = String(flag("work", ".migration"));
const DRY = !!flag("dry-run");
const FORCE = !!flag("force");
const ONLY = flag("only") ? String(flag("only")).split(",").map((s) => s.trim()).filter(Boolean) : null;

mkdirSync(WORK, { recursive: true });
mkdirSync(join(WORK, "img"), { recursive: true });
const P = {
  content: join(WORK, "old-content.json"),
  images: join(WORK, "image-map.json"),
  report: join(WORK, "apply-report.json"),
};
const readJson = (p, dflt) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : dflt);
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2));
const log = (...a) => console.log(...a);
const slugify = (s) =>
  s.toLowerCase()
    .replace(/[čć]/g, "c").replace(/đ/g, "d").replace(/š/g, "s").replace(/ž/g, "z")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const norm = (s) => slugify(String(s ?? ""));

// ── CMS client ───────────────────────────────────────────────────────────────
let COOKIE = null;
async function cms(path, init = {}) {
  const headers = { "X-Project-Slug": PROJECT, ...(init.headers ?? {}) };
  if (COOKIE) headers.Cookie = COOKIE;
  if (init.body && typeof init.body === "string") headers["Content-Type"] ??= "application/json";
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
async function login() {
  const email = flag("email");
  const password = flag("password");
  if (!email || !password) throw new Error("--email and --password are required for this phase");
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Project-Slug": PROJECT },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  COOKIE = (res.headers.get("set-cookie") ?? "").split(";")[0];
  if (!COOKIE) throw new Error("login returned no cookie");
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — scrape linea.hr
// ─────────────────────────────────────────────────────────────────────────────

/** Slice out the innerHTML of the element that opens at `openIdx`. */
function sliceElement(html, openIdx) {
  const tagM = /^<([a-zA-Z][\w-]*)/.exec(html.slice(openIdx));
  if (!tagM) return "";
  const tag = tagM[1];
  const start = html.indexOf(">", openIdx) + 1;
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "gi");
  re.lastIndex = start;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index);
  }
  return html.slice(start);
}

function extractProduct(html, url) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const name = h1 ? plainText(parseHtml(h1[1])).replace(/\s+/g, " ").trim() : "";

  // description — the block that holds <h5>Opis proizvoda</h5>
  let description = "";
  const opis = /<h5[^>]*>\s*Opis proizvoda\s*<\/h5>/i.exec(html);
  if (opis) {
    const after = html.slice(opis.index + opis[0].length);
    // stop at the first <hr>, button or modal that follows the copy
    const stop = after.search(/<hr\b|<button\b|<div[^>]+class="[^"]*modal/i);
    description = htmlToPlainDescription(stop === -1 ? after.slice(0, 4000) : after.slice(0, stop));
  }

  // tabs — titles from the tab nav, bodies from the panes (paired by href/id)
  const titles = [];
  for (const m of html.matchAll(/<a[^>]+data-toggle="tab"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = /href="#([^"]+)"/i.exec(m[0]);
    titles.push({ id: href ? href[1] : null, title: plainText(parseHtml(m[1])).replace(/\s+/g, " ").trim() });
  }
  const panes = [];
  for (const m of html.matchAll(/<div[^>]+class="tab-pane[^"]*"[^>]*>/gi)) {
    const idM = /id="([^"]+)"/i.exec(m[0]);
    panes.push({ id: idM ? idM[1] : null, html: sliceElement(html, m.index) });
  }
  const tabs = titles.map((t, i) => {
    const pane = panes.find((p) => p.id && p.id === t.id) ?? panes[i];
    return { title: t.title, html: pane?.html ?? "" };
  }).filter((t) => t.title);

  return { url, slug: url.replace(/\/$/, "").split("/").pop(), name, description, tabs };
}

async function phaseScrape() {
  // The OLD sitemap is both STALE (it lists 404s) and INCOMPLETE (it misses live
  // product pages, e.g. fiksni-jarboli-za-zastave), so the crawl seeds from it
  // AND from the home page, then follows every internal /hr/ link it meets — the
  // megamenu on each page links the whole catalog.
  log("→ scrape: crawling linea.hr (sitemap + link graph)");
  const xml = await fetch(OLD_SITEMAP).then((r) => r.text()).catch(() => "");
  const seeds = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

  const skip = (u) => !u.startsWith(`${OLD_ORIGIN}/hr/`) || u.includes("/novosti/") || /\.(pdf|jpe?g|png|zip|docx?)$/i.test(u);
  const queue = [`${OLD_ORIGIN}/hr/`, ...seeds.filter((u) => !skip(u))];
  const seen = new Set();
  const products = [];
  let fetched = 0;
  let dead = 0;

  while (queue.length) {
    const url = queue.shift().replace(/[#?].*$/, "").replace(/\/$/, "");
    if (!url || seen.has(url) || skip(`${url}/`)) continue;
    seen.add(url);

    let res;
    try { res = await fetch(url); } catch (e) { log(`  ! fetch failed ${url}: ${e.message}`); continue; }
    if (!res.ok) { dead += 1; continue; } // stale sitemap entry
    const html = await res.text();
    fetched += 1;

    for (const m of html.matchAll(/href="(\/hr\/[^"#?]*)"/g)) {
      const abs = `${OLD_ORIGIN}${m[1]}`.replace(/\/$/, "");
      if (!seen.has(abs) && !skip(`${abs}/`)) queue.push(abs);
    }

    const p = extractProduct(html, url);
    if (!p.description && !p.tabs.length) continue; // a category page, not a product
    if (ONLY && !ONLY.includes(p.slug)) continue;
    products.push(p);
    if (fetched % 25 === 0) log(`  … ${fetched} pages fetched, ${products.length} products, ${queue.length} queued`);
  }
  log(`  crawl done: ${fetched} pages (${dead} dead links skipped), ${products.length} product pages`);

  // convert to TipTap with image placeholders (real urls land in the apply phase)
  const missing = new Set();
  const emptyTabs = [];
  for (const p of products) {
    p.detailTabs = p.tabs.map((t) => ({
      id: slugify(t.title) || `tab-${Math.random().toString(36).slice(2, 8)}`,
      title: t.title,
      content: htmlToTiptap(t.html, {
        mapImage: (src) => {
          const abs = src.startsWith("http") ? src : `${OLD_ORIGIN}${src}`;
          missing.add(abs);
          return abs; // rewritten in `apply` via image-map.json
        },
        mapHref: (href) => (href.startsWith("/") ? `${OLD_ORIGIN}${href}` : href),
      }),
    })).filter((t) => {
      // A tab the OLD site renders EMPTY (its widget row holds nothing — most of
      // the "Naši radovi" galleries are like this) is dropped rather than
      // migrated as a blank tab.
      if (t.content) return true;
      emptyTabs.push(`${p.slug}/${t.title}`);
      return false;
    });
    delete p.tabs;
  }

  // every legacy asset the content still points at — images (collected above)
  // plus the files the document lists link to
  const assets = new Set(missing);
  for (const u of JSON.stringify(products).match(/https?:\/\/linea\.hr\/[^"\\]+/g) ?? []) assets.add(u);

  writeJson(P.content, { scrapedAt: new Date().toISOString(), products, assets: [...assets], emptyTabs });
  log(`✔ scrape: ${products.length} products, ${assets.size} distinct assets (${missing.size} images) → ${P.content}`);
  const noTabs = products.filter((p) => !p.detailTabs.length).map((p) => p.slug);
  if (noTabs.length) log(`  note: ${noTabs.length} product(s) have no tabs at all: ${noTabs.join(", ")}`);
  if (emptyTabs.length) log(`  note: ${emptyTabs.length} tab(s) dropped as EMPTY on the old site (e.g. ${emptyTabs.slice(0, 3).join(", ")})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — images: download from linea.hr, upload into the CMS media library
// ─────────────────────────────────────────────────────────────────────────────

/** Readable file name for a legacy image url (drops the storage hash suffix). */
function niceName(url, productSlug, shared) {
  const file = decodeURIComponent(url.split("/").pop() ?? "image.png");
  const dot = file.lastIndexOf(".");
  const ext = dot === -1 ? ".png" : file.slice(dot).toLowerCase();
  let base = dot === -1 ? file : file.slice(0, dot);
  base = base.replace(/_[0-9a-f]{16,}$/i, "").replace(/[-_]\d{6,}$/, ""); // legacy hash tail
  const stem = slugify(base) || "slika";
  return shared ? `${stem}${ext}` : `${productSlug}-${stem}${ext}`.replace(new RegExp(`^${productSlug}-${productSlug}-`), `${productSlug}-`);
}

async function ensureFolder(name, parentId = null) {
  // GET /api/media/folders → { folders, rootCount }
  const res = await cms("/api/media/folders");
  const list = Array.isArray(res) ? res : (res.folders ?? res.data ?? []);
  const hit = list.find((f) => f.name === name && (f.parentId ?? null) === parentId);
  if (hit) return hit.id;
  if (DRY) return `dry:${name}`;
  const made = await cms("/api/media/folders", {
    method: "POST",
    body: JSON.stringify({ name, parentId }),
  });
  return made.id;
}

async function uploadOne(buf, fileName, folderId, mime) {
  const fd = new FormData();
  fd.append("file", new Blob([buf], { type: mime }), fileName);
  const headers = { "X-Project-Slug": PROJECT, Cookie: COOKIE };
  const res = await fetch(`${API}/api/media/upload?folderId=${encodeURIComponent(folderId)}`, {
    method: "POST", headers, body: fd,
  });
  if (res.status === 409) {
    // Same display name already in this folder → reuse the existing row. Match on
    // the BASE name: the API re-encodes raster images to WebP, so a `.png` upload
    // is stored (and duplicate-checked) as `.webp`.
    const base = fileName.replace(/\.[^.]+$/, "").toLowerCase();
    const existing = await cms(`/api/media?folderId=${encodeURIComponent(folderId)}&limit=200`);
    const rows = existing.data ?? existing;
    const hit = rows.find((r) => (r.originalName ?? "").replace(/\.[^.]+$/, "").toLowerCase() === base);
    if (hit) return hit;
    throw new Error(`409 duplicate for ${fileName} but no existing row found`);
  }
  if (!res.ok) throw new Error(`upload ${fileName} → ${res.status} ${await res.text()}`);
  return res.json();
}

const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", svg: "image/svg+xml",
  // legacy document lists link to these — the media library stores non-images
  // under its "documents" prefix, so they migrate the same way.
  pdf: "application/pdf", zip: "application/zip",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function phaseImages() {
  const data = readJson(P.content, null);
  if (!data) throw new Error(`missing ${P.content} — run the scrape phase first`);
  const map = readJson(P.images, {});

  // usage count per image → shared images live in one folder, the rest per product
  const usage = new Map();
  for (const p of data.products) {
    const srcs = new Set(JSON.stringify(p.detailTabs).match(/https?:\/\/linea\.hr\/[^"\\]+/g) ?? []);
    for (const s of srcs) usage.set(s, [...(usage.get(s) ?? []), p.slug]);
  }
  const todo = [...usage.keys()].filter((u) => !map[u]);
  log(`→ assets: ${usage.size} referenced, ${todo.length} to upload${DRY ? " (dry-run: nothing uploaded)" : ""}`);
  if (!todo.length) return;

  if (!DRY) await login();
  const rootId = DRY ? "dry:root" : await ensureFolder("Proizvodi");
  const sharedId = DRY ? "dry:shared" : await ensureFolder("Zajedničko", rootId);
  const folderCache = new Map();
  const byHash = new Map(Object.values(map).filter((m) => m.hash).map((m) => [m.hash, m]));

  let done = 0;
  for (const url of todo) {
    const users = usage.get(url);
    const shared = users.length > 1;
    let buf;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      log(`  ! download failed ${url}: ${e.message}`);
      map[url] = { error: String(e.message) };
      continue;
    }
    const hash = createHash("sha256").update(buf).digest("hex");
    if (byHash.has(hash)) { map[url] = { ...byHash.get(hash), reusedBy: "hash" }; done += 1; continue; }

    const fileName = niceName(url, users[0], shared);
    const ext = fileName.split(".").pop().toLowerCase();
    let folderId = sharedId;
    if (!shared) {
      const key = users[0];
      if (!folderCache.has(key)) folderCache.set(key, DRY ? `dry:${key}` : await ensureFolder(key, rootId));
      folderId = folderCache.get(key);
    }
    if (DRY) {
      map[url] = { hash, fileName, folder: shared ? "Proizvodi/Zajedničko" : `Proizvodi/${users[0]}`, cdnUrl: `dry://${fileName}` };
    } else {
      const row = await uploadOne(buf, fileName, folderId, MIME[ext] ?? "application/octet-stream");
      map[url] = { hash, fileName, mediaId: row.id, cdnUrl: row.cdnUrl ?? row.url, folderId };
      byHash.set(hash, map[url]);
    }
    done += 1;
    if (done % 10 === 0) { log(`  … ${done}/${todo.length}`); writeJson(P.images, map); }
  }
  writeJson(P.images, map);
  const failed = Object.entries(map).filter(([, v]) => v.error);
  log(`✔ assets: ${done} handled, ${failed.length} failed → ${P.images}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — apply to the CMS
// ─────────────────────────────────────────────────────────────────────────────

/** Swap every legacy linea.hr asset reference — image sources AND link targets
 *  (the document lists link to PDFs) — for its uploaded CDN url. An unmapped
 *  asset keeps the original absolute url (still renders) and is reported. */
function rewriteAssets(node, map, stats) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => rewriteAssets(n, map, stats));
  let out = { ...node };
  if (out.type === "image" && typeof out.attrs?.src === "string") {
    const hit = map[out.attrs.src];
    if (hit?.cdnUrl) { stats.mapped += 1; out = { ...out, attrs: { ...out.attrs, src: hit.cdnUrl } }; }
    else stats.unmapped.push(out.attrs.src);
  }
  if (Array.isArray(out.marks)) {
    out.marks = out.marks.map((m) => {
      if (m.type !== "link" || typeof m.attrs?.href !== "string") return m;
      const hit = map[m.attrs.href];
      if (hit?.cdnUrl) { stats.mapped += 1; return { ...m, attrs: { ...m.attrs, href: hit.cdnUrl } }; }
      if (m.attrs.href.startsWith(OLD_ORIGIN)) stats.unmapped.push(m.attrs.href);
      return m;
    });
  }
  if (out.content) out.content = rewriteAssets(out.content, map, stats);
  return out;
}

async function phaseApply() {
  const data = readJson(P.content, null);
  if (!data) throw new Error(`missing ${P.content} — run the scrape phase first`);
  const imageMap = readJson(P.images, {});

  await login();

  // REFUSE to run against an API that predates core #194: its zod schema would
  // silently DROP `description`/`detailTabs` while still accepting `blocks: []`,
  // i.e. erase every product body and store nothing in its place. The catalog
  // presenter always emits `detailTabs` (possibly empty) once the API is new.
  const list = await cms("/api/commerce/products?limit=500");
  const rows = list.data ?? list;
  const probeSlug = rows.map((p) => (p.translations ?? {})[LOCALE]?.slug).find(Boolean);
  const probe = probeSlug
    ? await cms(`/api/commerce/catalog/products/${encodeURIComponent(probeSlug)}?locale=${LOCALE}`).catch(() => null)
    : null;
  if (!probe || !("detailTabs" in probe)) {
    throw new Error(
      "This API does not support the first-class product content model (core #194).\n" +
      "Deploy the core + project changes first — applying now would wipe the existing product bodies."
    );
  }

  // Category slug chains, so a product can be matched by WHERE it lives as well
  // as by its slug: the OLD catalog has several same-slug products in different
  // categories (plakati, ostalo, beach-flag), and the NEW catalog disambiguated
  // them with a "-2" suffix — only the category tells which is which.
  const catList = await cms("/api/commerce/categories");
  const cats = new Map((catList.data ?? catList).map((c) => [c.id, c]));
  const chainOf = (id) => {
    const out = [];
    for (let c = cats.get(id); c; c = c.parentId ? cats.get(c.parentId) : null) {
      out.push((c.translations ?? {})[LOCALE]?.slug ?? "");
    }
    return out.reverse().join("/");
  };
  const chainsOf = (p) => (p.categories ?? []).map((m) => chainOf(m.categoryId)).filter(Boolean);

  const bySlug = new Map(); // slug → candidates (a slug can repeat across locales)
  const byName = new Map();
  for (const p of rows) {
    for (const [, c] of Object.entries(p.translations ?? {})) {
      if (c?.slug) bySlug.set(c.slug, [...(bySlug.get(c.slug) ?? []), p]);
      if (c?.name) byName.set(norm(c.name), [...(byName.get(norm(c.name)) ?? []), p]);
    }
  }

  /** Every NEW product that could be this OLD slug. When the OLD catalog had two
   *  products with the same slug in different categories, the commerce migration
   *  had to make the second one unique — "plakati" + "plakati-2", "beach-flag" +
   *  "beach-flagg" — so those suffixed variants are candidates too. */
  const candidatesFor = (slug) => {
    const re = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(-\\d+|g)?$`);
    const out = [];
    for (const [key, list] of bySlug) if (re.test(key)) out.push(...list);
    return out;
  };

  /** Pick the candidate whose category chain matches the OLD url's own path. */
  const pick = (candidates, oldUrl) => {
    const uniq = [...new Set(candidates)];
    if (uniq.length <= 1) return uniq[0] ?? null;
    const path = oldUrl.replace(`${OLD_ORIGIN}/hr/`, "").split("/").slice(0, -1).join("/");
    const exact = uniq.filter((p) => chainsOf(p).includes(path));
    if (exact.length === 1) return exact[0];
    const partial = uniq.filter((p) => chainsOf(p).some((c) => c && (path.startsWith(c) || c.startsWith(path))));
    return partial.length === 1 ? partial[0] : (exact[0] ?? partial[0] ?? null);
  };

  const report = { at: new Date().toISOString(), dryRun: DRY, updated: [], skipped: [], unmatched: [], collisions: [], unmappedImages: [] };
  const claimed = new Map(); // productId → the OLD url that claimed it

  for (const old of data.products) {
    if (ONLY && !ONLY.includes(old.slug)) continue;
    const wantSlug = SLUG_OVERRIDES[old.slug] ?? old.slug;
    const cands = candidatesFor(wantSlug);
    const target = pick(cands.length ? cands : (byName.get(norm(old.name)) ?? []), old.url);
    if (!target) { report.unmatched.push({ slug: old.slug, name: old.name, url: old.url }); continue; }
    if (claimed.has(target.id)) {
      // two OLD pages resolved to the same product — the category disambiguation
      // failed, so flag it instead of silently overwriting the earlier write
      report.collisions.push({ slug: old.slug, url: old.url, productId: target.id, alsoClaimedBy: claimed.get(target.id) });
      continue;
    }
    claimed.set(target.id, old.url);

    const full = await cms(`/api/commerce/products/${target.id}`);
    const tr = structuredClone(full.translations ?? {});
    const cur = tr[LOCALE];
    if (!cur?.name) { report.skipped.push({ slug: old.slug, target: null, reason: `no ${LOCALE} translation` }); continue; }
    // "migrated" = it already carries first-class content (a product whose OLD
    // page had no tabs still gets a description, so check both)
    if ((cur.detailTabs?.length || cur.description) && !FORCE) { report.skipped.push({ slug: old.slug, target: cur.slug, reason: "already migrated (use --force)" }); continue; }

    const stats = { mapped: 0, unmapped: [] };
    const detailTabs = (old.detailTabs ?? []).map((t) => ({ ...t, content: rewriteAssets(t.content, imageMap, stats) }));
    if (stats.unmapped.length) report.unmappedImages.push({ slug: old.slug, srcs: [...new Set(stats.unmapped)] });

    tr[LOCALE] = { ...cur, description: old.description || undefined, detailTabs, blocks: [] };
    for (const loc of Object.keys(tr)) delete tr[loc].slug; // server derives it

    const entry = {
      slug: old.slug, url: old.url, target: cur.slug ?? wantSlug, productId: target.id,
      descriptionChars: (old.description ?? "").length,
      tabs: detailTabs.map((t) => t.title), images: stats.mapped,
    };
    if (DRY) { report.updated.push({ ...entry, dryRun: true }); continue; }

    const updated = await cms(`/api/commerce/products/${target.id}`, {
      method: "PUT",
      body: JSON.stringify({ translations: tr, version: full.version }),
    });
    if (updated.status === "active") {
      await cms(`/api/commerce/products/${target.id}/publish`, { method: "POST", body: "{}" });
      entry.published = true;
    }
    report.updated.push(entry);
    log(`  ✓ ${old.slug} → ${entry.tabs.length} tabs, ${entry.images} images`);
  }

  // NEW products the OLD site has nothing for — compared over the TARGET
  // LOCALE's slugs only (the catalog also carries English ones).
  const touched = new Set([...report.updated, ...report.skipped].map((u) => u.target ?? u.slug));
  report.newOnly = rows
    .map((p) => (p.translations ?? {})[LOCALE]?.slug)
    .filter((s) => s && !touched.has(s));
  writeJson(P.report, report);
  log(`✔ apply${DRY ? " (dry-run)" : ""}: ${report.updated.length} products, ${report.skipped.length} skipped, ${report.unmatched.length} unmatched, ${report.collisions.length} collisions → ${P.report}`);
  if (report.unmatched.length) log(`  unmatched OLD: ${report.unmatched.map((u) => u.slug).join(", ")}`);
  if (report.collisions.length) log(`  COLLIDING OLD pages (not written): ${report.collisions.map((c) => c.url).join(", ")}`);
  const unexpectedNewOnly = report.newOnly.filter((s) => !KNOWN_NEW_ONLY.includes(s));
  if (unexpectedNewOnly.length) log(`  NEW products with no OLD source: ${unexpectedNewOnly.join(", ")}`);
}

// ── main ─────────────────────────────────────────────────────────────────────
const phases = { scrape: phaseScrape, images: phaseImages, apply: phaseApply };
if (phase === "all") {
  await phaseScrape();
  await phaseImages();
  await phaseApply();
} else if (phases[phase]) {
  await phases[phase]();
} else {
  console.error(`unknown phase "${phase}" — expected: scrape | images | apply | all`);
  process.exit(1);
}
