# cms-ai-project-linea — Claude Development Guide

This file is auto-loaded by Claude Code at the start of every session.

---

## What this project is

Minimal, content-managed light-theme website powered by `cms-ai-core`.
Mantine UI (light, `primaryColor: "teal"`), system-ui font, centered layout.
Ships with code-defined page types registered in `admin/src/main.tsx`. The
catalogue uses a **flat product model**: a single **`product-item`** type whose
instances live directly under the **`all-products`** landing page and carry their
category as data. The old `products` → `product-category` folder pages were
**removed** (see "Flat product taxonomy" below). Everything else uses the
built-in `default` type (or runtime types).

### `product-item` page type (flat)

- Code-defined in `admin/src/main.tsx` as `productItemPageType`:
  `label: { en: "Product", hr: "Proizvod" }`, `canBeRoot: false`,
  `allowedParentTypes: ["all-products"]`, **`hideFromTree: true`**,
  `allowBlocks: true`, `allowedBlockTypes: ["product-item"]`. Because there's
  exactly one allowed block type, the framework treats this as a
  **singleton-block page type** (see cms-ai-core CLAUDE.md): on create the admin
  auto-seeds one `product-item` block, and the "+ Add new section" and per-block
  Remove buttons are hidden. **`hideFromTree` keeps the ~100 items out of the
  Pages tree entirely** — they're created/edited/deleted from the dedicated
  **Products** sidebar screen (`admin/src/products/ProductsScreen.tsx`), not the
  tree. The public URL is therefore flat: `/{locale}/{all-products-slug}/{item-slug}`.
- **Category**: the block carries `mainCategoryId` + `subcategoryId` (cascading
  dropdowns at the top of `ProductItemBlock`, sub disabled until a main is
  picked). They reference entries in the `product_categories` project-setting
  (see below). The category is **per-locale block data**; the migration writes it
  to every locale and the public catalogue reads it per-locale.
- The block (`admin/src/blocks/ProductItemBlock.tsx`) holds all authored
  product content: alternative title, main photo, gallery, plain-text
  description, EUR price, an "Additional info" section with real Mantine
  `Tabs` (each tab has its own RTE panel — five predefined Croatian
  titles backed by stable internal IDs: `vise-informacija`, `nasi-radovi`,
  `tehnika-tiska`, `upute-graficka-priprema`, `upute-slaganje`; editors
  can rename/add/remove tabs through small Mantine modals), and a
  "Konfigurator cijene" section with three Mantine `Accordion` panels
  acting as three **groups** (internal keys stay `konstrukcija` / `grafika`
  / `baza`; the customer-facing **titles are editable per group** and
  **required** when the configurator is enabled — empty by default,
  default-titled "1./2./3. grupa" in the accordion header until filled).
  Each group-2 (`grafika`) row exposes one EUR cijena input per group-1
  (`konstrukcija`) row, prefixed with that group-1 row's `naziv`, and
  **group 2 is locked (greyed via a nested `<fieldset disabled>`) until
  group 1 has at least one item**. Group 3 (`baza`) is independent. Every
  price input has a `do dvije decimale` format hint; prices are stored as
  free-text strings and are all optional.
- **Enable toggle (`konfiguratorCijene.enabled`)**: a checkbox on the
  "Konfigurator cijene" header gates the whole section. **Unchecked by
  default** — a native `<fieldset disabled>` greys out and disables every
  configurator input. When **checked**, the standalone **price field
  (`priceEur`) is disabled** (the two pricing inputs are mutually
  exclusive). Legacy rows saved before the toggle existed have no `enabled`
  flag; `normalize()` (admin) and `ProductItemView` (frontend) both default
  it to "on iff the row already carries configurator data" so fixed-price
  products keep their price field active. Required group-title validation
  is best-effort (asterisk + inline error) — the block API has no
  save-blocking hook, so an editor can still save with empty titles.
- A frontend renderer **is** wired up in `src/routes/PageView.tsx` via the
  `ProductItemView` component (selected by `page.type === "product-item"`).
  It implements the **"Industrial Clarity"** product-detail design — lime-
  green palette (`#496800` primary / `#9acb34` accent, scoped via a `D` const
  inside `PageView.tsx`, the rest of the site keeps Mantine teal), Inter
  (loaded in `index.html`), 4px radii, `#c3c9b1` outlines. Responsive 7/5
  grid: image gallery + description + social share on the left, sticky
  configurator card on the right (`top: 96px` at ≥lg, full-width above the
  image on mobile). The card holds the three `Select`s + price row +
  `Pošaljite upit` CTA + "Dostupno" / "Brza dostava" trust row. A sticky
  bottom bar with price + same CTA mirrors the card on `<lg`.
- **Info section is tabs-or-accordion by viewport** — at ≥768px the
  predefined "Additional info" tabs render as a Mantine `Tabs` strip
  (label-md uppercase, 2px lime underline on active, horizontally
  scrollable). At <768px the same data renders as a Mantine `Accordion`
  in **single-open mode** (no `multiple`), controlled via `openInfoItem:
  string | null`. All items start collapsed (initial state is `null`);
  the open header's text flips to lime via an inline `style={{ color:
  isOpen ? D.primary : D.onSurface }}` on the `Accordion.Control`. Swap signal is
  `useMediaQuery("(max-width: 767.99px)", false, { getInitialValueInEffect:
  false })` so the first render reads the real viewport and there's no
  tabs→accordion flicker on hydration.
- **Price area** has three modes, driven by the `konfiguratorCijene.enabled`
  toggle:
  1. **Konfigurator** — when the toggle is **on** AND any `cijena` across
     the three groups parses to > 0. Renders the group `Select`s (one per
     non-empty group), each using the editor-set group title (falling back
     to the `product.option_*` string). Selects are **deselectable/clearable
     and start empty** — nothing is pre-selected. **Group 2 (`grafika`) stays
     disabled until something in group 1 is picked**, and clearing group 1
     also clears group 2 (its price keys off `cijene[selectedKonstrukcija.id]`).
     Total is the sum of the currently-selected items. **With nothing
     selected the product is treated exactly like Inquiry** (no price shown,
     `Pošaljite upit` CTA) — selecting at least one option reveals the total.
  2. **Fixed price** — when the toggle is **off** AND `priceEur` parses to
     > 0, display that single value (`Intl.NumberFormat("hr-HR", { style:
     "currency", currency: "EUR" })`, e.g. `12,34 €`).
  3. **Inquiry** — everything else, including **toggle off + empty price**:
     render the `Pošaljite upit` button (no-op for now; wire to a real
     enquiry-submit flow when needed).
  All displayed prices are followed by a small dimmed `+ PDV` suffix.
  Free-text `cijena` strings are parsed with `parsePrice` (handles comma
  or dot decimal separator); empty / non-positive values resolve to 0.

### Flat product taxonomy & the Products screen

The old `products` (main-category folder) and `product-category` (subcategory
folder) page types were **removed**. They had no frontend view and made the Pages
tree unwieldy with ~100 leaf items. The taxonomy is now plain data and products
are managed in a dedicated screen.

- **Taxonomy data** lives in the generic `project_settings` store under key
  **`product_categories`** (public GET, so the frontend reads it like any other
  project setting):
  ```
  { categories: [ { id, slug, label:{hr,en}, subcategories:[ { id, slug, label:{hr,en} } ] } ] }
  ```
  A product references a main + subcategory by `id` (stable across renames);
  `slug` is used for catalogue deep-links (`?kategorija=<main-slug>`). Shared
  admin model in `admin/src/products/categoryModel.ts`; frontend resolver in
  `src/lib/productCategories.ts`.
- **Products sidebar screen** (`admin/src/products/ProductsScreen.tsx`), injected
  via **`createAdmin({ navSections: [productsNavSection] })`** (a cms-ai-core
  capability — see core CLAUDE.md "Project-injected sidebar screens"). Key
  `products`, icon `Boxes`, roles developer/admin/editor. Two tabs:
  - **Products** — a searchable, paginated table of every `product-item` (drafts
    + published) with main/sub **category filters**. Rows show thumbnail, title,
    main/sub category, status. "New product" calls the injected `createPage(
    "product-item", <all-products-id>)`; row click / pencil calls `openPageEditor(
    id)`; trash soft-deletes via the admin API. Returning from the editor remounts
    the screen so the table refreshes.
  - **Categories** — the taxonomy editor (add/rename/remove main categories &
    subcategories, per-locale labels, auto-slug). Saves `product_categories`.
  - Talks to authenticated admin endpoints through `admin/src/lib/adminApi.ts`
    (cookie auth + `X-Project-Slug`, paging past the 100-row list cap) since
    admin-base doesn't re-export page CRUD.
- **Migration** from the old folder model: `scripts/migrate-flatten-products.mjs`
  (run `pnpm migrate:flatten-products`, `--dry-run` to preview). Builds
  `product_categories` from the existing folder pages, writes `mainCategoryId`/
  `subcategoryId` onto every item's block in all locales, re-parents items to
  `all-products` (resolving slug collisions), and hard-deletes the folder pages +
  their runtime `page_types` rows. Needs `DATABASE_URL`; requires the `pg`
  devDependency (`pnpm install`).

## Related repos

`cms-ai-core` must be cloned as a sibling directory.

---

## Running

```bash
./start.sh    # starts everything: Docker DB, migrations, user seed, API, admin, frontend
./stop.sh     # clean shutdown
```

Custom core path: `CMS_CORE_DIR=/path/to/cms-ai-core ./start.sh`

`start.sh` runs `tsx src/migrate.ts` before the seed step so a brand-new DB
(no existing `pgdata` volume) doesn't crash with
`relation "users" does not exist`. The step is idempotent — safe to re-run.

---

## Tech stack

React 19 + Vite 6, React Router v7, Mantine 7 (light, teal), TypeScript,
PostgreSQL 16 (Docker)

**Site-wide content width** is **1140px**. The redesigned header, footer and
homepage use the CSS class **`.ln-container`** (max-width 1140px + responsive
gutter, defined in `src/styles/base/_layout.scss`; the `--ln-container` /
`--ln-gutter` tokens live in `src/styles/abstracts/_tokens.scss`); the remaining (Mantine) routes
still use `<Container size={1140}>` in `src/routes/RootLayout.tsx`'s `<main>`.
**The homepage renders full-bleed** — `RootLayout` drops the `<main>` container
for the index route (`isHome`) so the homepage's alternating tinted bands span
the viewport, while each section keeps its own inner `.ln-container`.

**Direction A redesign (lime).** Header, footer and homepage follow the "Clean &
Corporate" design: lime `#9acb34` accent, **Archivo** (headings/wordmark) +
**Hanken Grotesk** (body). It is plain `className`-based styling scoped with
`.ln-*` (chrome/buttons) and `.a-*` / `.ln-home` (homepage) prefixes, so it
coexists with Mantine. **The global Mantine theme is still light/teal**
(`src/main.tsx`) — the redesigned surfaces are lime purely via the stylesheet's
CSS vars and `.ln-btn` classes, so a full theme swap (which would re-tint every
Mantine content route) is still pending.

**Stylesheets are SCSS** (compiled by Vite via the `sass` dev dependency) and live
under `src/styles/` in a layered architecture — no inline single-line rules:

- `abstracts/_tokens.scss` — the `:root` design tokens (`--brand`, `--ink`,
  `--border`, `--ln-container`, …), kept as CSS custom properties so they stay
  runtime-themeable; `abstracts/_breakpoints.scss` — the `mq($max-width)`
  max-width media-query mixin (`@use "../abstracts/breakpoints" as *;`).
- `base/` — `_layout.scss` (`.ln-container`, `.ln-img`, `.a-thumb`),
  `_header.scss`, `_footer.scss`, `_buttons.scss` (`.ln-btn*`).
- `sections/_home.scss` — homepage + the shared `.a-*` content primitives
  (`.a-section`, `.a-head`, `.a-eyebrow`, `.a-prod`, `.a-banner`, …) that the
  About and Product pages also reuse.
- `global.scss` — the global entry that `@use`s tokens + base + sections in the
  original cascade order; **imported once in `src/main.tsx`**.
- `pages/*.scss` — per-route page styles (`cart`, `catalog`, `catalogues`,
  `news`, `eu`, `product`, `mixed`, `detail`, `about`, `notfound`), each
  **imported by the route that uses it** (preserves per-route import structure);
  `components/modals.scss` — global modals/banner, imported by the modal
  components. Page/component partials reference the global `var(--…)` tokens
  directly and only `@use` the breakpoints mixin where needed.

**Fonts** — Archivo + Hanken Grotesk + Inter are loaded site-wide via Google
Fonts (`<link>` in `index.html`). The Mantine theme still uses Inter; the lime
surfaces pull Archivo/Hanken via the stylesheet. System fonts fall back if the
network blocks Google Fonts.

---

## Page types

The product catalogue is **flat**: `product-item` pages live under `all-products`
and carry their category as block data (see "Flat product taxonomy" above).

| Slug | Label (en / hr) | Source | Parent | Children |
|---|---|---|---|---|
| `all-products` | All products / Svi proizvodi | code-defined (`admin/src/main.tsx`) | (root) | `product-item` |
| `product-item` | Product / Proizvod | code-defined (`admin/src/main.tsx`) | `all-products` | (leaf) |
| `about-us` | About us / O nama | code-defined (`admin/src/main.tsx`) | (root) | (none) |
| `catalogues` | Catalogues / Katalozi | code-defined (`admin/src/main.tsx`) | (root) | (none) |
| `news` | News / Novosti | code-defined (`admin/src/main.tsx`) | (root) | `article` |
| `article` | Article / Članak | code-defined (`admin/src/main.tsx`) | `news` | (leaf) |
| `eu-projects` | EU Projects / EU Projekti | code-defined (`admin/src/main.tsx`) | (root) | `eu-project-item` |
| `eu-project-item` | EU Project / EU Projekt | code-defined (`admin/src/main.tsx`) | `eu-projects` | (leaf) |
| `search` | Search / Pretraga | code-defined (`admin/src/main.tsx`) | (root) | (none) |
| `cart` | Cart / Košarica | code-defined (`admin/src/main.tsx`) | (root) | (none) |
| `404` | 404 / 404 | code-defined (`admin/src/main.tsx`) | (root) | (none) |

`product-item` is a `hideFromTree` singleton-block page type — see the sections
above. It is managed from the **Products** sidebar screen, not the Pages tree.

`all-products` is the public **catalogue landing page** AND the structural parent
of every product: `canBeRoot: true`, `deletable: false`, `limit: 1` (singleton),
`allowedChildTypes: ["product-item"]`, no blocks, no fields beyond the title. It
is also a **`system: true`** type — developer-only in the admin tree,
orange-tagged. Its frontend renderer (`AllProductsView` in
`src/routes/AllProductsView.tsx`, branched on `page.type === "all-products"` in
`PageView.tsx`) fetches every published `product-item` in the active locale (via
`getAllPages()` in `lib/api.ts`) plus the `product_categories` taxonomy (via
`getProductCategories()`), resolves each item's main/sub category from its block
data, and builds the card URL as `/{locale}/{all-products-slug}/{item-slug}`. It
renders a left filter sidebar + a sortable, paginated product grid:
- **Search** (title), **Categories** (main categories from the taxonomy),
  **Subcategories** (narrow to the picked main categories), and a **price range**.
  Filters apply live; a price bound excludes inquiry-only products.
- **Sort** (newest / oldest / name / price low→high / price high→low) and
  **per-page** size (12/24/48) + pagination apply immediately. Inquiry-only
  products always sort last under price sorts.
- **Card price** uses the same rules as `ProductItemView`: a fixed `priceEur`
  shows bare; a configurator product shows its **cheapest full build**
  (cheapest Konstrukcija + its cheapest Grafika + cheapest Baza, only groups
  with rows) prefixed "Već od" (`allproducts.price_from`); products with no
  usable price show "Cijena na upit". The shared price logic lives in
  `computeCardPrice()` (exported from `AllProductsView.tsx`).
- All visible copy uses `allproducts.*` string keys (seeded in
  `project-data.seed.json`, EN + HR).

`about-us` is a **singleton root page** (`canBeRoot: true`, `deletable: false`,
`limit: 1`, no parent, no children). It is a **singleton-block page type**
(`allowBlocks: true`, `allowedBlockTypes: ["about-us"]`) — same mechanics as
`product-item`: the framework auto-seeds one `about-us`
block on create and hides "+ Add new section" + the per-block Remove icon, so the
editor shows a single fixed Content Section card. Content lives in the block
(`admin/src/blocks/AboutUsBlock.tsx`, `aboutUsBlock` registered in `main.tsx`),
**not** in page-level `typeData` fields. The block's `data` shape:
- `altTitle: string` (Alternativni naslov), `heroImage: GalleryImage | null` (Hero slika, picked via
  `ImagePickerModal` in `single` mode → `{ mediaId, cdnUrl }`), `subtitle: string` — under "Osnovni podaci"
- `section2Title: string` (Naslov sekcije 2) + `description: string` (Opis) — under "Sekcija 2";
  `section3Title` (Naslov sekcije 3) + `section3Subtitle` (Podnaslov sekcije 3) — under "Sekcija 3".
  Editor group order is **Osnovni podaci → Gumbi → Sekcija 2 → Sekcija 3**.
- `btn1Link` / `btn2Link: LinkData | null` — each button is a **single CMS link
  picker** (`LinkPickerModal` in `rte` mode, opened with `showTextFields`). The
  button's label and tooltip live **inside** the `LinkData` as `linkText` /
  `tooltip` — there is no longer a separate `btn1Text` / `btn2Text` field.
  `normalize()` folds any legacy `btn1Text` / `btn2Text` from older saves into
  the link's `linkText`, so pages authored before this change keep their copy.
  **Anchor CTA:** point a button's link at a Remote URL of `#kontakt` and the
  frontend smooth-scrolls to section 3 instead of navigating (e.g. "Kontaktiraj nas").
The block previously had an `icon` field; it was **removed** (the editor no longer
shows an icon picker for About-us). Older saves may still carry an `icon` key in
their stored `data` — it's ignored by `normalize()` and harmless.
Rendered by `AboutUsView` (see "Frontend rendering" below).

`catalogues` is a **singleton root page** (`canBeRoot: true`, `deletable: false`,
`limit: 1`, no parent, no children) powering the public **"Katalozi" resource
library** page. It is a **singleton-block page type** (`allowBlocks: true`,
`allowedBlockTypes: ["catalogues"]`) — same mechanics as `about-us`. Content lives
in the `catalogues` block (`admin/src/blocks/CataloguesBlock.tsx`, `cataloguesBlock`
registered in `main.tsx`). The block's `data` shape:
- `subtitle: string` — intro lead under the page title (Croatian).
- `documents: Array<{ id, title, file }>` — the downloadable list. Each `file` is a
  media reference `{ mediaId, cdnUrl, name, size, mimeType }` **picked from the media
  library as a document** (not an image) via `ImagePickerModal` opened with
  `fileType="document"` (the picker shows file-icon tiles and returns the extra
  `name`/`size`/`mimeType` metadata — see cms-ai-core CLAUDE.md). `title` is an
  author-supplied **display title** (defaults to a tidied filename) so the frontend
  shows nice names instead of raw PDF filenames. Rows reorder/remove in the editor.
- `coverImages: GalleryImage[]` — a pool of placeholder cover photos the frontend
  **rotates through** to give each document card an image (`coverImages[i % len]`).
  Seeded once (no editor UI) and round-tripped by `normalize()` so author saves keep it.
- `contactLink: LinkData | null` — the "Contact support" CTA target (configurable link
  picker; seeded as a Remote URL `/hr/o-nama#kontakt` → the About-us contact section).
Rendered by `CataloguesView` (see "Frontend rendering" below). Unlike `about-us`, this
page type is **not** in `project-data.seed.json` — it's code-only (matching
`about-us` / `all-products`). The 5 sample PDFs + 10 placeholder covers + the
catalogues page itself were prepopulated via API into the running project (not via
the from-scratch seeder).

`news` is the **singleton root container** for the article listing
(`canBeRoot: true`, `deletable: false`, `limit: 1`, no parent, `allowBlocks: false`,
no fields beyond the title). Its only direct children are `article` pages. `article`
(`canBeRoot: false`, `allowedParentTypes: ["news"]`, **deletable, no limit**) is a
content page that carries an `articleType` **`select` field whose options come from
Settings → Article** (`optionsSource: "article"` → `GET /api/project-settings/article`),
two structured `image-url` fields — `articlePhoto` (the main image) and `cardPhoto`
(the smaller listing thumbnail) — **plus an unlimited number of Mixed Content
sections**. It uses the admin-base `multiBlock: true` flag
alongside `allowedBlockTypes: ["mixed-content"]` so the editor is restricted to
mixed-content yet escapes the singleton-block behaviour (the "+ Add new section"
button + layout picker stay visible; no block is auto-seeded). Neither type is in
`project-data.seed.json` — both are code-only. **`news` has a frontend renderer**
(`NewsView` in `src/routes/NewsView.tsx`, branched on `page.type === "news"` in
`PageView.tsx`): it fetches every published `article` page (`getAllPages("article", locale)`),
keeps the ones whose `parentId` is this news page, and renders a journal-style listing —
a featured (latest) article, a filter bar built from the distinct `articleType` values,
a Latest/Oldest sort, an article grid, and client-side pagination (9 per page). Listing cards
(featured + grid) always use **`cardPhoto` ("fotografija kartice")**, plus a type badge / date /
SEO-meta excerpt. Article links resolve to `/{locale}/{news-slug}/{article-slug}`.
**`article` detail pages** render via **`ArticleView`** (a small component in `PageView.tsx`,
branched on `page.type === "article"`): the `articleType` **type badge** + the large
**`articlePhoto` ("fotografija članka")** above the title, then the Mixed Content body
(reusing `BlockRenderer`). So `cardPhoto` is the listing thumbnail and `articlePhoto` is the
detail-page hero — the two image fields never overlap in use.

`eu-projects` / `eu-project-item` mirror the news/article pattern. `eu-projects`
is the **singleton root container** for the EU-project listing (`canBeRoot: true`,
`deletable: false`, `limit: 1`, no parent, `allowBlocks: false`) — it carries a
single `mainPhoto` **`image-url` field** beyond the title. Its only direct children
are `eu-project-item` pages. `eu-project-item` (`canBeRoot: false`,
`allowedParentTypes: ["eu-projects"]`, **deletable, no limit**) carries one
`mainPhoto` `image-url` field **plus an unlimited number of Mixed Content sections**
(`multiBlock: true` + `allowedBlockTypes: ["mixed-content"]`) — **no badge/select
fields**. Both are code-only (not in `project-data.seed.json`). **`eu-projects` has
a frontend renderer** (`EuProjectsView` in `src/routes/EuProjectsView.tsx`, branched
on `page.type === "eu-projects"` in `PageView.tsx`): it fetches every published
`eu-project-item` page (`getAllPages("eu-project-item", locale)`), keeps those whose
`parentId` is this page, and renders a plain-Mantine card grid (project `mainPhoto` +
title + SEO-meta excerpt) with client-side pagination (9 per page) — no featured card,
no filter bar (no type field). Item links resolve to `/{locale}/{eu-projects-slug}/{item-slug}`.
**`eu-project-item` detail pages** render via **`EuProjectItemView`** (a small component
in `PageView.tsx`): the `mainPhoto` above the title, then the Mixed Content body
(reusing `BlockRenderer`) — no badges or other chrome.

`search`, `cart`, and `404` (together with `all-products`) are **functional
singleton root pages** flagged **`system: true`** (`canBeRoot: true`,
`deletable: false`, `limit: 1`, no parent, no children, `allowBlocks: false`).
They hold no authored content — they exist only as page slots so the frontend
can render the search-results, cart, and 404 views at CMS-managed URLs (default
slugs `/pretraga`, `/kosarica`, `/404`). `system: true` (admin-base feature)
**hides them from the Pages tree + New-Page picker for every role except
`developer`**, and renders them with an **orange accent** (instead of the green
level palette) for developers — so editors/admins never see this developer-only
plumbing. There are
**no in-chrome search/cart controls yet** — those land with the navigation work
later; until then the search view reads its query from `?q=…` on the URL and the
cart view shows placeholder line items. Rendered by `SearchView` / `CartView` /
`NotFound` (see "Frontend rendering").

The built-in `default` and the code-defined `product-item` / `all-products` (+
the others) are registered in code. The old `products` / `product-category`
runtime seed entries were removed from `project-data.seed.json` (the migration
deletes any leftover rows). The frontend renders the default view for any
page type without a `case` branch in `PageView.tsx` — currently
`product-item`, `all-products`, `about-us`, `catalogues`, `news`, `article`,
`eu-projects`, `eu-project-item`, `search`, `cart`,
and `404` have custom views (see "Frontend rendering").

**Slugs are immutable** after create. The previous taxonomy
(`product-main-category`, `product-sub-category`, `product-item`) was migrated
to the current names via a one-time SQL transaction that cascaded
`pages.type` and `menus.auto_page_types` in lockstep — don't repeat that ad
hoc; document any new type rename and ship it as a migration on the API side
if it ever has to happen again.

If a new custom page type is needed:

1. **Code-defined** — add a `PageTypeDefinition` and pass it via
   `createAdmin({ pageTypes: [...] })` in `admin/src/main.tsx`. **Always
   ask the user for both EN and HR label** before writing it; also confirm
   `deletable`, `limit`, `perParentLimit`, `canBeRoot`, and
   `allowed{Parent,Child}Types` if relevant. Then add a matching `case` in
   `src/routes/PageView.tsx`'s switch.
2. **Runtime-defined** — either create from the developer-only **Pages →
   Options drawer** (one-off) **or** add a `pageTypes` entry in
   `project-data.seed.json` (preferred for typed-up-front from-scratch
   bootstrap). Frontend still needs a matching `case` in `PageView.tsx` to
   render it as anything other than the default view.

See `cms-ai-core/CLAUDE.md` and `docs/project-CLAUDE-template.md` for the
full rules.

---

## Seeding project data (`project-data.seed.json`)

Per-project bootstrap data — translation strings + runtime page types — lives
in `project-data.seed.json` at the project root. `start.sh` reads it on every
run (step "3b") and calls
`cms-ai-core/apps/api/src/seed-project-data.ts`, which upserts both arrays
with `ON CONFLICT DO NOTHING`. **Existing rows are never overwritten** so
editor edits via the admin Strings UI / Pages → Options drawer survive
re-seeds; to force-refresh, delete the row first.

Two arrays:

```json
{
  "strings":   [ { "locale": "hr|en|…", "key": "…", "value": "…" }, … ],
  "pageTypes": [ { "type": "…", "label": { "hr": "…", "en": "…" }, … }, … ]
}
```

Add new keys here whenever you introduce new `t('…')` calls in the frontend or
new runtime page types — that way a fresh DB has everything wired up after
one `./start.sh`. The script chunk-inserts strings in a single statement and
inserts page types one at a time.

## Full content snapshot (`db-snapshot.json`)

A committed `db-snapshot.json` at the project root holds the **entire current
content state** of the DB — pages, translations, menus, media references,
project/site settings — so a clone boots with the real catalogue instead of two
sample pages. `start.sh` step "3a" replays it (before the project-data seed) via
`cms-ai-core/apps/api/src/seed-db-snapshot.ts`, and sets `SEED_SKIP_SAMPLE_PAGES=1`
on the user seed so the sample pages don't get in the way.

Restore is **fresh-DB-only** for content tables (pages/translations/media —
skipped if rows already exist, so it never clobbers a live DB or duplicates) and
`ON CONFLICT DO NOTHING` for keyed tables; all UUIDs are preserved so embedded
`pageId`/`mediaId` references keep resolving.

To refresh after editing content in the admin, regenerate and commit it:

```bash
DATABASE_URL=postgresql://cms:cms_local_password@localhost:<DB_PORT>/project_linea \
PROJECT_SLUG=project-linea \
SNAPSHOT_FILE="$PWD/db-snapshot.json" \
  pnpm --filter @cms/api db:export   # run from cms-ai-core, or use an absolute SNAPSHOT_FILE
```

Secrets and environment config (`users`, `media_configs` Bunny key, `webhooks`,
the `site_settings` email block) are excluded/scrubbed, so the file is safe to
commit publicly. Media **binaries** live in Bunny CDN — only the `media_files`
rows are seeded, so configure Bunny under Media → Options before uploading new
media on a clone.

---

## Header, footer & homepage (Direction A — `RootLayout.tsx`, `HomePage.tsx`)

- **Header** (`SiteHeader` in `RootLayout.tsx`) — sticky white 64px bar: lime-dot
  wordmark, **flat single-level** primary nav (no dropdowns; top-level
  `getMenu("primary", locale)` items only, `NavLink` → `.is-active` lime
  underline), a **functional product search**, a visual-only cart link, the
  `LanguageSwitcher`, and a hamburger + mobile panel. **Search**: typing + Enter
  navigates to the search page with `?q=` — `SearchView` reads the query from the
  URL and filters live `product-item`s. The search/cart page slugs are resolved
  per-locale via `getSystemPageSlug("search"|"cart", locale)` (live slug, falling
  back to `pretraga`/`kosarica`) rather than hardcoded.
- **Footer** (`SiteFooter` in `RootLayout.tsx`) — dark deep-green band: brand +
  `tagline` (from site settings, rendered only when set) · **"Stranice"**
  (dynamic `getMenu("footer", locale)`) · **"Kontakt"** (real values from the
  `contact` project-setting; the maps link reuses `AboutUsView`'s exported
  `extractMapEmbedSrc` + `mapsAppLink` to turn the stored `<iframe>` embed into a
  deep-link), then a copyright bottom bar. Structural labels go through `t()`
  (`footer.*` keys) with Croatian fallbacks.
- **Homepage** (`HomePage.tsx`) — full-bleed, six sections: typographic **hero**
  (stat strip = main-category count + subcategory count from the `product_categories`
  taxonomy), **product groups grid** (one card per **main category** from the
  taxonomy + a fixed "Cijeli katalog" CTA tile; card links to
  `?kategorija=<main-slug>`; thumbnail = first product photo in that category),
  **featured banners** (`getFeaturedBanners()`, icon resolved via lucide's `icons`
  registry), **"Zašto Linea" trust strip**, **newest 4 `product-item`s** (reuses
  `computeCardPrice`), and a **contact CTA band** (phone from the `contact`
  setting). The "Browse products"/"Full catalogue"/"Request a quote" CTAs resolve
  `all-products` (`svi-proizvodi`) and `about-us` (`o-nama`) slugs dynamically via
  `getSystemPageSlug`. All non-dynamic copy lives in the strings DB under
  `home.*` (EN + HR, seeded in `project-data.seed.json`).

---

## Frontend rendering (`src/routes/PageView.tsx`)

- `default` (and any unknown type) — `DefaultView`: H1 title + block list.
- `product-item` — `ProductItemView`; `all-products` — `AllProductsView` (separate file).
- `catalogues` — **`CataloguesView`** (`src/routes/CataloguesView.tsx`). Plain-Mantine resource-library
  layout: page title + `subtitle` lead, a **featured first document** card (cover + meta + download), then a
  `SimpleGrid` of the remaining document cards, and a "Contact support" CTA card at the bottom. Each card's
  cover photo is taken from `coverImages` by index (rotating). The download button links to `file.cdnUrl`;
  the meta line shows `TYPE • size` (e.g. `PDF • 4.2 MB`) derived from the file's `mimeType`/`size`. Static
  copy (`catalogues.download` / `catalogues.empty` / `catalogues.cta_heading` / `catalogues.cta_text` /
  `catalogues.cta_button`) reads from `useStrings().t('catalogues.*')` (seeded in `project-data.seed.json`,
  EN+HR). The CTA button resolves `contactLink` via the same local `resolveHref()` as `AboutUsView`.
- `news` — **`NewsView`** (`src/routes/NewsView.tsx`). Plain-Mantine journal listing. Fetches every published
  `article` page via `getAllPages("article", locale)`, keeps those whose `parentId === page.id`, and derives a
  card per article from `typeData` (`articleType`, **`cardPhoto`**) + the article's SEO `metaDescription` as the
  excerpt. Renders a **featured** (latest) article, a **filter bar** built from the distinct `articleType` values
  present (chips + an "All"/"Sve" reset), a **Latest/Oldest sort** `Select`, a responsive `SimpleGrid` of article
  `Card`s (card image, type `Badge`, date, title, excerpt, "read" link), and client-side **`Pagination`** (9 per
  page; featured excluded from the grid). **All listing cards use `cardPhoto` ("fotografija kartice")** — the
  larger `articlePhoto` is only used on the article detail page. Article hrefs are
  `/{locale}/{news-slug}/{article-slug}`. UI labels use a small inline locale map (`LABELS.en`/`LABELS.hr`) — no
  string keys needed; all article content is real CMS data.
- `article` — **`ArticleView`** (a component inside `src/routes/PageView.tsx`). Article detail page: the
  `articleType` **type `Badge`** + the large **`articlePhoto` ("fotografija članka")** above the title, then the
  Mixed Content body (reuses `BlockRenderer`). Reads both fields straight from `page.typeData`.
- `eu-projects` — **`EuProjectsView`** (`src/routes/EuProjectsView.tsx`). Plain-Mantine card listing (the
  simpler news cousin). Fetches every published `eu-project-item` page via `getAllPages("eu-project-item", locale)`,
  keeps those whose `parentId === page.id`, and derives a card from `typeData.mainPhoto` + the item's SEO
  `metaDescription` as the excerpt. Renders a responsive `SimpleGrid` of `Card`s (main photo, title, excerpt,
  "view" link) with client-side **`Pagination`** (9 per page) — no featured card and no filter bar (the type has
  no badge/select field). Item hrefs are `/{locale}/{eu-projects-slug}/{item-slug}`. UI labels use a small inline
  locale map (`LABELS.en`/`LABELS.hr`).
- `eu-project-item` — **`EuProjectItemView`** (a component inside `src/routes/PageView.tsx`). Detail page: the
  **`mainPhoto` ("glavna fotografija")** above the title, then the Mixed Content body (reuses `BlockRenderer`).
  No badges or other chrome.
- `about-us` — **`AboutUsView`** (`src/routes/AboutUsView.tsx`). Plain-Mantine layout (positioning only, not
  pixel-perfect). Reads the singleton `about-us` block's data:
  - **Hero**: `altTitle` (H1) + `heroImage` (rendered via Mantine `Image`; grey placeholder when unset) +
    `subtitle` (lead) + `btn1Link` (filled) / `btn2Link` (outline) buttons. Buttons resolve `LinkData` → href
    via a local `resolveHref()` (mirrors `PageView`'s `LinkRenderer`, using `page.linkPages` + locale); label
    is `LinkData.linkText`. A button whose href is a `#anchor` smooth-scrolls instead of navigating — section 3
    has `id="kontakt"`, so a button linked to `#kontakt` scrolls there.
  - **Section 2**: `section2Title` (heading) with `description` (body) directly under it, then the
    **Featured banners** cards.
  - **Section 3**: `section3Title` + `section3Subtitle`, a static inquiry form (UI only, not wired), and the
    **Contact** panel. All static chrome (form labels/placeholders/options, contact labels, map button) reads
    from editor-managed strings via `useStrings().t('about.*')` — keys live in `project-data.seed.json` (EN+HR)
    and are editable in **Settings → Strings**. No hardcoded English remains in this view.
  - **Featured banners** come from `getFeaturedBanners()` (`GET /api/project-settings/featured_banners`) —
    locale-aware `title`/`content` (`pickLocalized()` falls back to defaultLocale), icon resolved by name via
    `lucide-react`'s `icons` namespace. **`lucide-react` was added as a frontend dependency** for this.
  - **Contact** comes from `getContactInfo()` (`GET /api/project-settings/contact`) — phone/fax/email/address
    + the map. Phone & fax render as `tel:` links (open the dialer on mobile); email as `mailto:`. The map
    thumbnail is `public/map.svg` (a stylized Ivanić-Grad map). The `mapsUrl` setting may hold **either a bare
    URL or the full Google Maps "Embed a map" `<iframe …>` snippet** — `extractMapEmbedSrc()` pulls the real
    `src` URL out (pasting the whole `<iframe>` into an iframe `src` is what previously loaded our own site).
    Desktop click → `Modal` with an `<iframe src={embedSrc}>` + an "Open in Google Maps" button; Android/iOS
    (UA-sniffed) click opens a place link built from the address (`maps/search/?api=1&query=…`) so the OS
    hands it to the native maps app.
- `search` — **`SearchView`** (`src/routes/SearchView.tsx`). Reads the query from `?q=…` (no in-chrome search
  input yet). Fetches `product-item` via `getAllPages()` + the `product_categories` taxonomy + the
  `all-products` slug (for flat URLs), builds the same product cards (reuses `computeCardPrice` exported from `AllProductsView`),
  and free-text-matches title + description. No left sidebar — just a `"Showing N results for 'q'"` headline,
  a sort `Select` (reuses `allproducts.sort_*` keys), the card grid, and pagination (reuses
  `allproducts.per_page_label`). Three states: no query → `search.prompt`; query with no matches → no-results
  template (`search.empty_title` / `search.empty_text` + back-home button); query with matches → results.
- `cart` — **`CartView`** (`src/routes/CartView.tsx`). **Placeholder** simple-Mantine cart (no cart store /
  "add to cart" control exists yet). Seeds a few sample line items so the layout is reviewable: a list of
  item cards (image, name, unit price, quantity stepper via `NumberInput` + `lucide-react` Minus/Plus,
  remove via `Trash2`) on the left, an order-summary card (subtotal / shipping note / total + checkout +
  continue-shopping buttons) on the right, and an empty-cart branch (`ShoppingCart` icon + `cart.empty_*`).
  Swap the `INITIAL` constant for the real cart store when it lands. Copy via `t('cart.*')` (seeded EN+HR).
- `404` — **`NotFound`** (`src/routes/NotFound.tsx`). Simple centered Mantine 404 (big "404" + title + text +
  back-home button); copy via `t('notfound.*')` (seeded EN+HR). Rendered both for the `404` page type AND —
  more importantly — for **any path that doesn't resolve to a published page**: `PageView` now flips a
  `notFound` state (instead of redirecting home) when `getPageBySlug` returns null / an unpublished page / an
  error, and renders `<NotFound />` in place. The bad URL stays in the address bar. Unknown top-level paths
  are first rewritten to `/{defaultLocale}/…` by `LocaleGate`, then fall through to the same not-found path.

Child pages can be fetched via
`GET /api/pages?type=<childType>&parentId=<id>&locale=<locale>` if a custom
view needs them.

## Editor-managed strings (`useStrings()` / `t('key')`)

Frontend copy that isn't part of the page content lives in the core
**Strings** system (developer-only Strings tab in the admin, backed by
`GET /api/strings?locale=…`). Missing keys render as the literal key so
unfilled copy is obvious in the browser.

**Strings are seeded from-scratch** via `project-data.seed.json` (see
"Seeding project data" below) — when you add new `t('…')` calls in code,
also add the keys to that file so a fresh DB has them ready after one
`./start.sh`. The admin Strings UI is for *editing* what was seeded;
authoritative source-of-truth for new keys is the seed file.

**`ProductItemView` uses 23 keys under the `product.*` namespace** — all
already seeded for `hr` and `en`. When adding new visible copy to the
product view (or any other route), prefer `t("product.<key>")` over
hardcoded strings and seed both locales:

| Group | Keys |
|---|---|
| Breadcrumb | `product.breadcrumb_home` |
| Headings | `product.about_heading`, `product.configurator_heading` |
| Share row | `product.share_label`, `product.share_native`, `product.share_copy_link`, `product.share_email` |
| Configurator selects | `product.option_konstrukcija`, `product.option_grafika`, `product.option_baza`, `product.option_placeholder`, `product.option_locked`, `product.option_unnamed` (the `option_konstrukcija/grafika/baza` keys are now only fallbacks — editor-set group titles take priority) |
| Price labels | `product.price_inquiry_label`, `product.price_estimated_label`, `product.price_vat_suffix` |
| CTA / trust | `product.cta_send_inquiry`, `product.trust_available`, `product.trust_fast_delivery` |
| Mobile sticky bar | `product.mobile_price_label`, `product.mobile_total_label`, `product.mobile_on_inquiry` |
| Misc | `product.tab_empty`, `product.aria_view_image` |

The `t()` helper does **not** support interpolation — for things like
`View image N` we concat `${t("product.aria_view_image")} ${i + 1}`.

The **homepage** uses ~35 keys under the **`home.*`** namespace (hero, stat
strip, product-groups head + count suffixes, banners head, the 4 trust facts,
newest-products head, `home.price_vat`, contact band) and the **footer** uses
**`footer.*`** (column headings + contact-field labels) — all seeded EN + HR.
The hero's lime word is split into `home.hero_title_pre/_em/_post` so the
emphasised phrase stays editable without storing HTML.

## URLs and i18n

- URL shape: `/{locale}/{slug}`. Root `/` and any legacy `/{slug}` redirect to
  `/{defaultLocale}/...` via `LocaleGate` in `src/App.tsx` (React Router
  `<Navigate replace>` — SPA-level, not a real 301).
- `src/lib/locale.tsx` provides `LocaleConfigProvider` + `useLocaleConfig()`
  (boots from `GET /api/settings`), `PageAlternatesProvider` +
  `usePageAlternates()` (PageView publishes the active page's `alternates`
  map so the header `LanguageSwitcher` can offer per-locale slug-preserving
  navigation), and `StringsProvider` + `useStrings().t('key')` for editor-
  managed frontend copy (I7) — missing keys render the key string itself
  so unfilled copy is obvious.
- **URLs are hierarchical** — a page lives at `/{locale}/{ancestorSlugs…}/{slug}`
  (the ancestor page-slug chain). The router uses a splat `/:locale/*`; `PageView`
  reads `params["*"]` and passes the whole path to `getPageBySlug(locale, path)`,
  which encodes each segment and calls `/api/pages/by-slug/:locale/*`. Link widgets
  build hrefs from `linkPages[id][locale].path`; breadcrumbs build cumulative paths
  from the `ancestors` array (linkable only when every segment is active in the
  locale). `getPageBySlug` then promotes `translations[locale]` into the flat
  `title`/`slug`/`blocks`/`typeData` fields client-side.
- Mixed Content link widgets resolve `pageId → /{locale}/{slug}` from
  `page.linkPages` (no cached `pageSlug`), threaded through a local
  `RenderContext` in `PageView.tsx`.
- SEO: `<html lang>` updated on each navigation; `index.html` links
  `/sitemap.xml`; `RootLayout` appends one Atom-feed
  `<link rel="alternate" type="application/atom+xml" hreflang="…" href="/feed/{loc}.xml">`
  per available locale.

## Mixed Content widgets rendered

| Widget | Rendered as |
|---|---|
| `text` | Tiptap JSON → HTML via `src/lib/tiptapRenderer.ts` — mirrors the admin RichTextEditor's stored attrs: marks (bold/italic/underline/strike/code/link), `textAlign` + `indent` on paragraph/heading, image `alignment`/`width`/`height`. **Adding an editor attr means updating this walker too** (see core DECISIONS.md) |
| `video` | `<iframe>` inside `<AspectRatio ratio={16/9}>` so the embed always fills its box (no black side bars); an author-set width caps the frame as `maxWidth`. YouTube URLs auto-normalised |
| `link` | Anchor or Mantine Button; supports page/remote/email/file |
| `accordion` | Mantine `Accordion` |
| `gallery` | `SimpleGrid` (2 cols mobile, 3 on sm+), square 1:1 images |
| `section` | Nested layout — recursive `renderWidget`, `minWidth: 0` on inner columns |

---

## Admin panel (`admin/`)

```bash
cd admin
VITE_API_URL=http://localhost:3001 pnpm dev   # port 517X
```

Config in `admin/src/main.tsx`:
```ts
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin } from "@cms/admin-base";

createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-linea",
  pageTypes: [/* … */],
  blockTypes: [/* … */],
  settingsSections: [featuredBannersSection, contactSection, articleSection],  // project-only Settings tabs
});
```

`projectSlug` must match the Bunny CDN folder prefix and the `X-Project-Slug`
header used by `src/lib/api.ts`.

### Project-only Settings tabs (`admin/src/settings/`)

`createAdmin({ settingsSections: [...] })` appends linea-only tabs to the admin **Settings** screen.

- **Featured banners** (`admin/src/settings/FeaturedBannersSection.tsx`, `featuredBannersSection`) — three
  fixed boxes, each with a per-locale **title** + per-locale **content** + a shared lucide **icon**. The
  editing language follows the sidebar content-locale switcher; visible to admin + developer. Saved to the
  generic per-project store under key `featured_banners` via `saveProjectSettings`/`fetchProjectSettings`
  (`GET|PUT /api/project-settings/featured_banners`). Stored shape:
  `{ boxes: [{ icon, title: {hr,en}, content: {hr,en} }, …×3] }`.
- **Kontakt** (`admin/src/settings/ContactSection.tsx`, `contactSection`) — a single (not per-locale) set of
  contact details: `phone`, `fax`, `email` (validated client-side; Save disabled while a non-empty value
  isn't a valid address), `address` (single line), `mapsUrl` (Google Maps link). Visible to admin + developer.
  Saved under key `contact` (`GET|PUT /api/project-settings/contact`). Stored shape:
  `{ phone, fax, email, address, mapsUrl }`.
- **Article** (`admin/src/settings/ArticleSection.tsx`, `articleSection`) — a Mantine `TagsInput` (chips +
  "start typing…") that manages the editable list of **article types**. Visible to admin + developer. Saved
  under key `article` (`GET|PUT /api/project-settings/article`). Stored shape: `{ options: string[] }`. The
  `article` page type's `articleType` **`select` field uses `optionsSource: "article"`** so the editor's
  dropdown is fed by this list (admin-base fetches `GET /api/project-settings/article` and reads `options`) —
  add/remove a type here and it appears in the dropdown with no redeploy.
- **Frontend consumption:** read via `getFeaturedBanners()` / `getContactInfo()` in `src/lib/api.ts`
  (thin wrappers over `GET /api/project-settings/:key`). Currently consumed by `AboutUsView`; reuse the
  helpers anywhere else the data is needed. The store is public-readable — never put secrets in a section.

After changing `cms-ai-core/packages/admin-base`:
```bash
cd ../cms-ai-core && pnpm --filter @cms/admin-base build
# start.sh watches the dist and auto-restarts the admin dev server within ~2 s
# just reload your browser tab when you see "↻ admin-base updated" in the terminal
```

---

## Key files

| File | Purpose |
|---|---|
| `src/lib/api.ts` | CMS API client (`getPages({ locale })`, `getPageBySlug(locale, slug)`, `getMenu(name, locale)`, `getSiteSettings`, `getStrings`, `getFeaturedBanners`, `getContactInfo`, `getSystemPageSlug(type, locale)`) — locale-aware; `Page` carries `translations`, `alternates`, `linkPages` |
| `src/lib/locale.tsx` | `LocaleConfigProvider` + `useLocaleConfig()`; `PageAlternatesProvider` + `usePageAlternates()`; `StringsProvider` + `useStrings()` — `t('key')` falls back to the key itself when missing |
| `src/lib/tiptapRenderer.ts` | Tiptap JSON → HTML (no Tiptap runtime needed) |
| `src/App.tsx` | Route tree: `/` → defaultLocale redirect; `/:locale/*` gated by `LocaleGate` |
| `src/routes/RootLayout.tsx` | Shared layout — Direction A `SiteHeader` (flat nav + functional search + cart + mobile panel) and `SiteFooter` (dark deep-green, dynamic links + `contact` block); homepage renders full-bleed |
| `src/styles/global.scss` | Direction A global SCSS entry — `@use`s `abstracts/` (tokens, breakpoints mixin), `base/` (layout, header, footer, buttons) + `sections/_home.scss` (homepage + shared `.a-*` primitives); imported once in `main.tsx` |
| `src/styles/pages/*.scss` | Per-route page styles (`cart`, `catalog`, `catalogues`, `news`, `eu`, `product`, `mixed`, `detail`, `about`, `notfound`), each imported by its route; `components/modals.scss` = global modals/banner |
| `src/routes/HomePage.tsx` | Direction A homepage — hero, product groups grid, featured banners, trust strip, newest products, contact CTA band |
| `src/routes/PageView.tsx` | Renders the `default` page type and its Mixed Content blocks; switches custom views on `page.type` |
| `src/routes/NewsView.tsx` | `news` page type — journal listing of child `article` pages (featured + type filter + sort + grid + pagination) |
| `src/routes/EuProjectsView.tsx` | `eu-projects` page type — plain card listing of child `eu-project-item` pages (grid + pagination) |
| `src/routes/SearchView.tsx` | `search` page type — `?q=`-driven product-item results (cards + sort + pagination, no sidebar) + no-results template |
| `src/routes/CartView.tsx` | `cart` page type — placeholder simple-Mantine cart (sample line items + summary; empty-cart branch) |
| `src/routes/NotFound.tsx` | `404` page type — simple centered Mantine 404; localized via `t('notfound.*')` |
| `src/routes/LanguageSwitcher.tsx` | Globe-icon dropdown; hidden when only one locale is available |
| `admin/src/main.tsx` | `createAdmin` config |

---

## Environment variables

| Variable | Default |
|---|---|
| `VITE_CMS_API_URL` | `http://localhost:3001` |
| `VITE_API_URL` | `http://localhost:3001` |
| `VITE_FRONTEND_URL` | `http://localhost:3000` (set by `start.sh`; required for admin Preview button) |
| `ADMIN_PORT` | `517X` |
| `CMS_CORE_DIR` | `../cms-ai-core` |
| `SITE_URL` | `` (empty) — set to production domain for sitemap `<loc>` and Atom feed link URLs |
| `ADMIN_BASE_URL` | `http://localhost:5173` — where `/activate/:token` and `/reset/:token` invite/reset links land |
| `EMAIL_FROM` / `RESEND_API_KEY` / `SMTP_*` | unset — **fallback only**. Canonical per-project email config lives in admin **Settings → Advanced → Email** (developer-only). |
| `EMAIL_TO_OVERRIDE` | unset — dev safety net: re-routes every email to one address with the original recipient in the subject |

All email configuration (sender, transport, credentials) is managed per-project
in the admin UI. Env vars are first-boot fallbacks only.

---

## Keeping this file current

Update when: adding/changing page types, adding custom blocks, changing
frontend rendering. For non-obvious pitfalls affecting the CMS engine or
admin panel, see `../cms-ai-core/docs/DECISIONS.md`.
