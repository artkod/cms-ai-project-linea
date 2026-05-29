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
- A frontend renderer for `product-item` is **not yet implemented** in
  `src/routes/PageView.tsx` — add a switch case there when shipping the
  storefront. The block's data shape is the canonical contract.

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
