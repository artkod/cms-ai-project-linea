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
  `allowedParentTypes: ["product-sub-category"]`, `allowBlocks: true`,
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
  (`Konstrukcija`, `Grafika`, `Baza`). Each Grafika row exposes one EUR
  cijena input per Konstrukcija row, prefixed with that Konstrukcija
  row's `naziv`. Every price input has a `do dvije decimale` format hint;
  prices are stored as free-text strings to preserve formatting and are
  all optional.
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
- **Price area** has three modes (mutually exclusive, in priority order):
  1. **Fixed price** — when the block's `priceEur` parses to a number > 0,
     display that single value formatted via `Intl.NumberFormat("hr-HR",
     { style: "currency", currency: "EUR" })` (e.g. `12,34 €`).
  2. **Konfigurator** — when any `cijena` across Konstrukcija, Grafika
     (any per-Konstrukcija value), or Baza parses to > 0, render three
     Mantine `Select`s (one per non-empty category), pre-selecting the
     first option in each so the user sees a real total immediately.
     Grafika option prices come from `cijene[selectedKonstrukcija.id]`,
     so re-picking Konstrukcija also re-prices Grafika. Total is the sum
     of the three currently-selected items' resolved prices.
  3. **Inquiry** — when neither path produces a positive total, render a
     `Pošaljite upit` button (no-op for now; wire to a real
     enquiry-submit flow when needed).
  All displayed prices are followed by a small dimmed `+ PDV` suffix.
  Free-text `cijena` strings are parsed with `parsePrice` (handles comma
  or dot decimal separator); empty / non-positive values resolve to 0.

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

Only the built-in `default` page type is registered in code. The frontend
renders it via `DefaultView` in `src/routes/PageView.tsx` — title plus the
block list (Mixed Content widgets: text, video, link, accordion, gallery,
section).

If a custom page type is needed later:

1. **Code-defined** — add a `PageTypeDefinition` and pass it via
   `createAdmin({ pageTypes: [...] })` in `admin/src/main.tsx`. **Always
   ask the user for both EN and HR label** before writing it; also confirm
   `deletable`, `limit`, `perParentLimit`, `canBeRoot`, and
   `allowed{Parent,Child}Types` if relevant. Then add a matching `case` in
   `src/routes/PageView.tsx`'s switch.
2. **Runtime-defined** — created from the developer-only **Pages → Options
   drawer**. Stored in the `page_types` table. The admin renders it without
   any code change, but the frontend still needs a matching `case` in
   `PageView.tsx` to render it as anything other than the default view.

Slug is immutable once a type exists. See `cms-ai-core/CLAUDE.md` and
`docs/project-CLAUDE-template.md` for the full rules.

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

**`ProductItemView` uses 23 keys under the `product.*` namespace** — all
already seeded for `hr` and `en`. When adding new visible copy to the
product view (or any other route), prefer `t("product.<key>")` over
hardcoded strings and seed both locales:

| Group | Keys |
|---|---|
| Breadcrumb | `product.breadcrumb_home` |
| Headings | `product.about_heading`, `product.configurator_heading` |
| Share row | `product.share_label`, `product.share_native`, `product.share_copy_link`, `product.share_email` |
| Configurator selects | `product.option_konstrukcija`, `product.option_grafika`, `product.option_baza`, `product.option_placeholder`, `product.option_unnamed` |
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
- `getPageBySlug(locale, slug)` calls `/api/pages/by-slug/:locale/:slug` and
  promotes `translations[locale]` into the flat `title`/`slug`/`blocks`/
  `typeData` fields client-side.
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
});
```

`projectSlug` must match the Bunny CDN folder prefix and the `X-Project-Slug`
header used by `src/lib/api.ts`.

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
