# Production cutover — commerce module (inquiry-only webshop)

Ordered runbook for moving prod (cms5.artkod.opalstacked.com) from the legacy
page-based products to the commerce catalog. Local dev already runs the end
state (branch `feat/commerce-migration`, verified end-to-end 2026-07-19).

**Take a DB backup first** — step 5 hard-deletes the legacy product pages:

```bash
ssh <user>@<host> 'pg_dump "$DATABASE_URL" | gzip' > linea-pre-commerce-$(date +%F).sql.gz
# (DATABASE_URL as exported in ~/apps/cms5-api/start)
```

## 0. Preconditions

- cms-ai-core `chore/integrate-pending-branches` (contains the commerce sitemap /
  inquiry-email / db-snapshot / optionsLabel / option-price-hint work + the admin
  UX remake + auth-cookie fix; suite 621/621).
- cms-ai-project-linea `feat/commerce-migration` (commerce ON, storefront on the
  vendored `@cms/storefront`, migration + cleanup scripts, both vendored bundles
  rebuilt from the integrated core branch; admin + frontend prod builds verified).

## 1. Merge core → main

Merge `chore/integrate-pending-branches` into cms-ai-core `main` (your PR flow).
The push auto-deploys the prod API. **Watch prod health for 10+ minutes**
(DECISIONS #142 — the OOM failure mode appears only after the host's first
sweep, never at deploy time). Commerce stays **OFF** (env unset) — no
behavioural change; `/api/commerce/*` routes don't exist yet.

## 2. Enable commerce on the prod API

Env lives in the Opalstack watchdog start script:

```bash
ssh <user>@<host>
vi ~/apps/cms5-api/start          # add next to the existing exports:
  export COMMERCE_ENABLED=true
  export STOREFRONT_BASE_URL=https://cms5.artkod.opalstacked.com
pkill -f 'node --conditions=production dist/index.js'   # watchdog relaunches it
```

Boot applies the commerce migrations (0001–0058) to the prod DB. Verify:

```bash
curl -s https://cms5-api.artkod.opalstacked.com/api/commerce/health
# → {"status":"ok","enabled":true,"contractVersion":3}
```

The public site is still the legacy frontend — commerce routes existing is
invisible to it.

## 3. Migrate the catalog (prod DB)

From this repo (uses the `pg` devDependency; prod `DATABASE_URL` from the start
script). The legacy pages are still in the prod DB, so no `SNAPSHOT_FILE` needed:

```bash
DATABASE_URL='<prod url>' node scripts/migrate-products-to-commerce.mjs --dry-run
# Expect: 29 categories, 98 products (7 fixed / 51 inquiry / 40 configurator),
# 73 axes, 367 variants (36 unpriced combos skipped), 1 warning
# ("Šatori / Pokrov - crne boje (2)" — known duplicate row, review in admin later).
DATABASE_URL='<prod url>' node scripts/migrate-products-to-commerce.mjs
ssh <user>@<host> "pkill -f 'node --conditions=production dist/index.js'"   # reindex FTS at boot
```

## 4. Merge linea → main

Merge `feat/commerce-migration` into this repo's `main`. The deploy workflow
builds the admin from core `main` (step 1 must be merged first) and the frontend
with the committed `vendor/storefront` bundle, then rsyncs both.

**Transition window:** until step 5 runs, the legacy product pages still shadow
`/{locale}/svi-proizvodi/{slug}` — the new frontend renders them as a bare
default page (no product view). Keep the window short: verify (step 4a) and run
the cleanup right after.

### 4a. Verify

- Listing `/hr/svi-proizvodi`: grid + filters + prices ("Već od …" / "Na upit").
- Beach Flag (canonical path or via listing): h1 "Beach Flag", subtitle, option
  selects — Konstrukcija first (others locked), per-value prices
  (Medium — €23,90 / Feather A — €41,81 / Šiljak — €16,60), total €82,31.
- Cart → checkout (name/address/city/postal) → "Hvala na upitu!" → order page.
- Admin → Orders: the inquiry appears with the combination on the line; send a
  quote → customer email arrives (prod SMTP) → accept via the emailed link.
- Inquiry notification email arrives once set (step 6).

## 5. Remove the legacy pages (prod DB)

```bash
DATABASE_URL='<prod url>' node scripts/cleanup-legacy-products.mjs --dry-run
DATABASE_URL='<prod url>' node scripts/cleanup-legacy-products.mjs
```

Old `/{locale}/svi-proizvodi/{slug}` URLs now resolve the commerce products
(slugs were preserved verbatim). sitemap.xml carries the catalog at canonical
category paths; product pages emit matching `rel=canonical`.

## 6. Post-cutover admin config

- Settings → Commerce → **Notifications**: set the inquiry email (new-inquiry
  notifications are off while empty).
- Settings → Commerce → **Tax**: confirm `vatRegistered` matches reality (prices
  display "uključuju PDV" — default assumes VAT-registered).
- Products → Šatori: review the migrated duplicate grafika value
  ("Pokrov - crne boje (2)").
- Roles: content editors no longer manage products (content/commerce split) —
  grant `shop_admin`/`shop_manager` where needed (developer-only to grant).

## Rollback

- **Before step 5**: revert the linea `main` merge (redeploys the legacy
  frontend) and set `COMMERCE_ENABLED=false` in the start script + restart. The
  legacy pages were never touched; the commerce tables sit unused (toggling off
  is non-destructive).
- **After step 5**: the legacy pages are hard-deleted — restore from the step-0
  `pg_dump` (or re-seed pages from the pre-migration `db-snapshot.json` in git
  history). The frontend revert works the same either way.
