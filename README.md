# cms-ai-project-linea

Minimal light-theme website powered by [`cms-ai-core`](../cms-ai-core). Pages,
menus, media, settings, strings, and users are managed in the admin panel —
the frontend is a thin React 19 + Vite renderer for the published content.

## Prerequisites

- Node 20+ and `pnpm`
- Docker (for the PostgreSQL container)
- `cms-ai-core` cloned as a sibling directory

## Running locally

```bash
./start.sh        # boots Docker DB, runs migrations, seeds the dev user,
                  # restores the committed content snapshot (db-snapshot.json),
                  # starts API, admin, and the website on free ports
./stop.sh         # clean shutdown
```

On a fresh clone the committed `db-snapshot.json` is replayed automatically, so
the admin opens with the real pages/menus/media/settings (not sample pages). See
CLAUDE.md → "Full content snapshot" for the `db:export` command to refresh it.

By default the website runs on `:3000`, the admin on `:5174`, and the API on
`:3001` (start.sh picks the next free port when these are taken).

Default developer user (seeded on first run):

- email: `developer@artkod.com`
- password: `k0dart`

## Project layout

```
src/                   Frontend (React 19 + Vite 6, Mantine 7 light/teal)
  App.tsx              Locale-aware route tree
  routes/              RootLayout, HomePage, PageView, AllProductsView, LanguageSwitcher, NotFound
  lib/                 api.ts (CMS client), locale.tsx (providers), tiptapRenderer.ts
admin/                 Admin panel shell (three lines — calls createAdmin)
docker-compose.yml     PostgreSQL 16 container
start.sh / stop.sh     Dev orchestration
CLAUDE.md              Project guide for Claude Code (kept current)
```

## Customising

This project ships a **flat** product catalogue: `product-item` pages live under
the `all-products` landing page and carry their main/sub category as data (stored
in the `product_categories` project-setting, edited in the **Products** sidebar
screen). The old `products`/`product-category` folder page types were removed —
run `pnpm migrate:flatten-products` to migrate an existing DB. To add a
project-specific page type, see the
"Page types" section of `CLAUDE.md` (and the matching block in
`cms-ai-core/docs/project-CLAUDE-template.md`).

The admin already supports adding runtime page types from **Pages →
Options** (developer-only); the frontend just needs a matching `case` in
`src/routes/PageView.tsx` to render anything beyond the default view.

The admin **Settings** screen also carries linea-only tabs (passed via
`createAdmin({ settingsSections })` in `admin/src/main.tsx`): **Featured banners**
(three reusable highlight boxes, key `featured_banners`) and **Kontakt** (contact
details — phone/fax/email/address/maps link, key `contact`). Both live in
`admin/src/settings/` and are saved to the generic `project_settings` store; a
frontend renderer can read each via `GET /api/project-settings/:key`. See the
"Project-only Settings tabs" section of `CLAUDE.md`.

The admin also adds a top-level **Products** sidebar screen via
`createAdmin({ navSections })` (`admin/src/products/ProductsScreen.tsx`) — a table
of all products with category filters + a category-taxonomy editor. See the "Flat
product taxonomy & the Products screen" section of `CLAUDE.md`.

See [`cms-ai-core/CLAUDE.md`](../cms-ai-core/CLAUDE.md) and
[`cms-ai-core/docs/DECISIONS.md`](../cms-ai-core/docs/DECISIONS.md) for the
shared CMS engine — schema, API, admin behaviour, and known pitfalls.
