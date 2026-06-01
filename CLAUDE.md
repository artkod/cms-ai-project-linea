# cms-ai-project-linea — Claude Development Guide

This file is auto-loaded by Claude Code at the start of every session.

---

## What this project is

Minimal, content-managed light-theme website powered by `cms-ai-core`.
Mantine UI (light, `primaryColor: "teal"`), system-ui font, centered layout.
Ships with one code-defined page type — **`product-item`**, registered in
`admin/src/main.tsx`. Everything else uses the built-in `default` type (or
runtime types added via Pages → Options).

### `product-item` page type

- Code-defined in `admin/src/main.tsx` as `productItemPageType`:
  `label: { en: "Product", hr: "Proizvod" }`, `canBeRoot: false`,
  `allowedParentTypes: ["product-category"]`, `allowBlocks: true`,
  `allowedBlockTypes: ["product-item"]`. Because there's exactly one
  allowed block type, the framework treats this as a **singleton-block
  page type** (see cms-ai-core CLAUDE.md): on create the admin auto-seeds
  one `product-item` block, and the "+ Add new section" and per-block
  Remove buttons are hidden.
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

### `product-category` page type

- Originally seeded as a runtime type; now **code-defined** in
  `admin/src/main.tsx` as `productCategoryPageType` so it can carry a block.
  `label: { en: "Product category", hr: "Vrsta proizvoda" }`,
  `canBeRoot: false`, `deletable: true`, `allowedParentTypes: ["products"]`,
  `allowedChildTypes: ["product-item"]`, `allowBlocks: true`,
  `allowedBlockTypes: ["product-category"]`. With exactly one allowed block
  type it's a **singleton-block page type** (same mechanics as `product-item`:
  one block auto-seeded on create, no add/remove UI). The code def shadows
  the matching runtime row from `project-data.seed.json` (PageTypeContext
  drops runtime rows whose slug clashes with a code slug), so it takes effect
  with no DB change; the seed entry was updated to the same `allowBlocks` /
  `allowedBlockTypes` values to stay consistent. **Note:** `product-category`
  pages created *before* this change have no block and no add button — the
  auto-seed only fires at create time. Re-create such pages to pick up the block.
- The block (`admin/src/blocks/ProductCategoryBlock.tsx`) holds three fields:
  **Alternativni naslov** (text input), **Glavna slika** (single-image picker),
  and **Alternativna slika** (single-image picker). No frontend renderer yet —
  `product-category` falls through to `DefaultView` in `PageView.tsx`; add a
  `case` there if/when the category content needs a custom view.

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

**Site-wide content width** is **1140px** (Bootstrap 5 `container-xl` default).
All three `Container` instances in `src/routes/RootLayout.tsx` (header / main /
footer) use `size={1140}`. Mantine's default named sizes (md=992, lg=1184) don't
match Bootstrap, so we pass the number directly. Change all three if you ever
need to widen/narrow the layout.

**Inter font** is loaded site-wide via Google Fonts (`<link>` in `index.html`)
and set in the Mantine theme (`src/main.tsx`) at the front of the font stack
for both `fontFamily` and `headings.fontFamily`. System fonts fall back if the
network blocks Google Fonts.

---

## Page types

The product taxonomy on this project is three-level:

| Slug | Label (en / hr) | Source | Parent | Children |
|---|---|---|---|---|
| `all-products` | All products / Svi proizvodi | code-defined (`admin/src/main.tsx`) | (root) | (none) |
| `products` | Products / Proizvodi | code-defined (`admin/src/main.tsx`) | (root) | `product-category` |
| `product-category` | Product category / Vrsta proizvoda | code-defined (`admin/src/main.tsx`) | `products` | `product-item` |
| `product-item` | Product / Proizvod | code-defined (`admin/src/main.tsx`) | `product-category` | (leaf) |
| `about-us` | About us / O nama | code-defined (`admin/src/main.tsx`) | (root) | (none) |

`products` is `canBeRoot: true`, `deletable: true`, with **no limit** (multiple
root "Products" pages are allowed and they can be deleted). `product-category`
has no limit and is a singleton-block page type. `product-item` is a
singleton-block page type — see the sections above.

`all-products` is the public **catalogue landing page**: `canBeRoot: true`,
`deletable: false`, `limit: 1` (singleton), no children, no blocks, and no
fields beyond the title. Its frontend renderer (`AllProductsView` in
`src/routes/AllProductsView.tsx`, branched on `page.type === "all-products"` in
`PageView.tsx`) fetches **every** published `products` / `product-category` /
`product-item` page in the active locale (via `getAllPages()` in `lib/api.ts`,
which paginates past the API's 100-row cap) and joins each item to its category
(parent) and products (grandparent). It renders a left filter sidebar + a
sortable, paginated product grid (plain Mantine — no design system yet):
- **Search** (title), **Categories** (the `products` grandparent), **Subcategories**
  (the `product-category` parent — options narrow to the picked categories), and
  a **price range**. None of these re-filter the grid until **Apply filters** is
  pressed (Enter in the search box also applies); a price bound excludes
  inquiry-only products.
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
`product-item` / `product-category`: the framework auto-seeds one `about-us`
block on create and hides "+ Add new section" + the per-block Remove icon, so the
editor shows a single fixed Content Section card. Content lives in the block
(`admin/src/blocks/AboutUsBlock.tsx`, `aboutUsBlock` registered in `main.tsx`),
**not** in page-level `typeData` fields. The block's `data` shape:
- `subtitle`, `description: string`
- `section2Title: string` (Naslov sekcije 2), `section3Title: string` (Naslov sekcije 3),
  `section3Subtitle: string` (Podnaslov sekcije 3) — extra section headings. Editor group order is
  **Osnovni podaci → Gumbi → Sekcija 2 → Sekcija 3** (section2Title under "Sekcija 2"; section3Title +
  section3Subtitle under "Sekcija 3")
- `btn1Link` / `btn2Link: LinkData | null` — each button is a **single CMS link
  picker** (`LinkPickerModal` in `rte` mode, opened with `showTextFields`). The
  button's label and tooltip live **inside** the `LinkData` as `linkText` /
  `tooltip` — there is no longer a separate `btn1Text` / `btn2Text` field.
  `normalize()` folds any legacy `btn1Text` / `btn2Text` from older saves into
  the link's `linkText`, so pages authored before this change keep their copy.
The block previously had an `icon` field; it was **removed** (the editor no longer
shows an icon picker for About-us). Older saves may still carry an `icon` key in
their stored `data` — it's ignored by `normalize()` and harmless.
Resolve a button link's href on the frontend with `computeLinkHref()` and read the
label from `LinkData.linkText`. No custom `PageView.tsx` branch exists yet — add one when the
About-us page gets a bespoke renderer (it renders the default view until then).

The built-in `default` and the code-defined `products`, `product-category`, and
`product-item` are all registered in code. `products` and `product-category`
also have seed entries in `project-data.seed.json` that predate their code
definitions — the code defs shadow those rows (PageTypeContext drops runtime
rows whose slug clashes with a code slug), but the seed entries are kept
consistent so a fresh DB matches. The frontend renders the default view for any
page type without a `case` branch in `PageView.tsx` — currently
`product-item` and `all-products` have custom views.

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
run (step "3a") and calls
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

---

## Frontend rendering (`src/routes/PageView.tsx`)

- `default` (and any unknown type) — `DefaultView`: H1 title + block list.

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
| `text` | Tiptap JSON → HTML via `src/lib/tiptapRenderer.ts` |
| `video` | `<iframe>`, YouTube URLs auto-normalised |
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
  settingsSections: [featuredBannersSection],   // project-only Settings tabs
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
- **Frontend consumption (TODO):** a public renderer can read each section via
  `GET /api/project-settings/:key` (with `X-Project-Slug`) and reuse the data wherever needed.
  The store is public-readable — never put secrets in a settings section.

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
| `src/lib/api.ts` | CMS API client (`getPages({ locale })`, `getPageBySlug(locale, slug)`, `getMenu(name, locale)`, `getSiteSettings`, `getStrings`) — locale-aware; `Page` carries `translations`, `alternates`, `linkPages` |
| `src/lib/locale.tsx` | `LocaleConfigProvider` + `useLocaleConfig()`; `PageAlternatesProvider` + `usePageAlternates()`; `StringsProvider` + `useStrings()` — `t('key')` falls back to the key itself when missing |
| `src/lib/tiptapRenderer.ts` | Tiptap JSON → HTML (no Tiptap runtime needed) |
| `src/App.tsx` | Route tree: `/` → defaultLocale redirect; `/:locale/*` gated by `LocaleGate` |
| `src/routes/RootLayout.tsx` | Shared layout — sticky header, cascading flyout nav, `LanguageSwitcher`, footer |
| `src/routes/HomePage.tsx` | Locale-aware list of root-level published pages |
| `src/routes/PageView.tsx` | Renders the `default` page type and its Mixed Content blocks |
| `src/routes/LanguageSwitcher.tsx` | Globe-icon dropdown; hidden when only one locale is available |
| `src/nav.css` | CSS-only cascading dropdown nav (`.cms-nav`, `.cms-nav-dropdown`, `.cms-nav-sub`) |
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
