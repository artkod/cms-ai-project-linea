# Linea on Opalstack — paused (and how to resume)

**Status: PAUSED since 2026-09-23.** Linea was only a test deployment; it was switched
off to free memory on the shared 512 MB Opalstack account (`artkod_shell@opal17.opalstack.com`)
for another cms-ai-core project (Gora). Nothing was deleted — resuming is a few commands,
no redeploy.

## What "paused" means

| Piece | State |
|---|---|
| API (`~/apps/cms5-api`, port 26273, node + watchdog) | stopped (freed ~143 MB) |
| Frontend + admin (private nginx in `~/apps/cms5-frontend/nginx`, ports 17047 / 25083) | stopped (freed ~4 MB) |
| Crontab — the 6 `cms5-api` / `cms5-admin` / `cms5-frontend` lines (10-min keepalive + `@reboot`) | commented out with the prefix `#LINEA-OFF ` |
| GitHub `Deploy (frontend + admin)` workflow (`.github/workflows/deploy.yml`) | disabled manually |
| Code, build output, `start` scripts, PostgreSQL DB `cms5-linea`, Opalstack apps, domains, sites | untouched |

While paused the Linea domains return **502** — expected.

A crontab backup from just before the pause is on the server: `~/crontab.backup-2026-09-23`.

## Things that would switch it back on by accident

- **Manually running** `Update static nginx config` (`nginx-config.yml`) or
  `Migrate static hosting to private nginx` (`static-nginx.yml`) — both start the
  Linea nginx if it isn't running.
- Re-enabling Linea's `deploy.yml` — its "self-heal" step starts nginx.

## Since the pause: core no longer deploys Linea's API

As of cms-ai-core#179 every project deploys **itself** through core's
`deploy/opalstack/` kit (cms-ai-core `docs/DEPLOYMENT-OPALSTACK.md` → "The standard
setup"). Core's `deploy.yml` only dispatches `core-updated` to the projects in its
matrix, and Linea is **not** in it. So:

- Pushes to core `main` no longer touch Linea's server.
- The resume steps below bring Linea back **as it was**, on its legacy workflow. That
  workflow ships only the frontend + admin. The API would stay frozen at the core commit
  it had when paused (#164) and would drift from the admin it gets rebuilt against.

**To resume properly, move Linea onto the standard setup instead** (a one-off migration):

1. Opalstack: keep `cms5-api` as the API app. Use `cms5-frontend` as the web app: the
   kit's nginx serves `/` AND `/admin` from one app, so point the `/admin` site route at
   `cms5-frontend` too and retire `cms5-admin`.
2. Move the secrets out of `~/apps/cms5-api/start` into `~/.cms/project-linea/`:
   `db-password`, a **new** `jwt-secret` (the old one appeared in a session transcript —
   rotating it logs everyone out once), and `touch bootstrapped` (the DB already exists).
3. Commit `deploy/opalstack.env` (`PROJECT_SLUG=project-linea`, `API_APP=cms5-api`,
   `API_PORT=26273`, `WEB_APP=cms5-frontend`, the frontend port, both URLs,
   `DB_NAME`/`DB_USER=cms5-linea`, `COMMERCE_ENABLED=true`), replace
   `.github/workflows/deploy.yml` with cms-ai-gora's, and delete the legacy
   `static-nginx.yml` / `nginx-config.yml` / `deploy/nginx/`.
4. Add `artkod/cms-ai-project-linea` to the matrix in core's `deploy.yml`.
5. Then: restore the cron lines, enable the workflow, run it.

The server's `~/apps/cms5-api/repo` is a git clone whose embedded GitHub token had
expired (removed on 2026-09-23). The kit rsyncs the tree and never needs git there.

## Resume as-is (legacy workflow)

Check free memory first — Linea needs ~150 MB. With another cms-ai-core API running
on the account, both together may not fit in 512 MB.

```bash
ssh opalstack

# 1) memory check (sum of RSS of all your processes)
ps -u $USER -o rss= | awk '{s+=$1} END {printf "%.0f MB\n", s/1024}'

# 2) restore the cron lines (keepalive + @reboot)
crontab -l | sed 's/^#LINEA-OFF //' | crontab -
crontab -l | grep cms5            # all 6 lines, no prefix

# 3) start the API and nginx, detached so they survive logout
setsid ~/apps/cms5-api/start      >/dev/null 2>&1 < /dev/null &
setsid ~/apps/cms5-frontend/start >/dev/null 2>&1 < /dev/null &

# 4) verify
sleep 8
curl -s http://localhost:26273/api/health    # → {"status":"ok","db":{"ok":true,...}}
ss -ltn | grep -E ':(26273|17047|25083) '
```

Then, locally:

```bash
gh workflow enable deploy.yml     # in cms-ai-project-linea
```

and open https://cms5-api.artkod.opalstacked.com/api/health plus the frontend and
`/admin` in a browser.

Don't skip step 2: the cron lines are what bring the apps back after a crash or a
server reboot.

## Pausing again

```bash
ssh opalstack
crontab -l > ~/crontab.backup-$(date +%F)
crontab -l | sed -E '/\/apps\/cms5-(api|admin|frontend)\/start/s/^/#LINEA-OFF /' | crontab -

# stop the API: watchdog first (else it restarts node in 3 s), then node on its port.
# Find PIDs by hand — `pkill -f 'apps/cms5-api/start'` inside `ssh host '...'` also
# matches (and kills) the ssh command itself, because its text contains the pattern.
ps -u $USER -o pid,cmd | grep '[c]ms5-api/start'     # → kill <pid>
fuser -k 26273/tcp

~/apps/cms5-frontend/stop
```

Then `gh workflow disable deploy.yml` locally.
