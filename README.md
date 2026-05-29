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
                  # starts API, admin, and the website on free ports
./stop.sh         # clean shutdown
```

By default the website runs on `:3000`, the admin on `:5174`, and the API on
`:3001` (start.sh picks the next free port when these are taken).

Default developer user (seeded on first run):

- email: `developer@artkod.com`
- password: `k0dart`

## Project layout

```
src/                   Frontend (React 19 + Vite 6, Mantine 7 light/teal)
  App.tsx              Locale-aware route tree
  routes/              RootLayout, HomePage, PageView, LanguageSwitcher, NotFound
  lib/                 api.ts (CMS client), locale.tsx (providers), tiptapRenderer.ts
admin/                 Admin panel shell (three lines — calls createAdmin)
docker-compose.yml     PostgreSQL 16 container
start.sh / stop.sh     Dev orchestration
CLAUDE.md              Project guide for Claude Code (kept current)
```

## Customising

This project ships with **no custom page types** — every page uses the
built-in `default` type. To add a project-specific page type, see the
"Page types" section of `CLAUDE.md` (and the matching block in
`cms-ai-core/docs/project-CLAUDE-template.md`).

The admin already supports adding runtime page types from **Pages →
Options** (developer-only); the frontend just needs a matching `case` in
`src/routes/PageView.tsx` to render anything beyond the default view.

See [`cms-ai-core/CLAUDE.md`](../cms-ai-core/CLAUDE.md) and
[`cms-ai-core/docs/DECISIONS.md`](../cms-ai-core/docs/DECISIONS.md) for the
shared CMS engine — schema, API, admin behaviour, and known pitfalls.
