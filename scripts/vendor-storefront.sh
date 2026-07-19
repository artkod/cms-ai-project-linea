#!/usr/bin/env bash
set -euo pipefail
# ─────────────────────────────────────────────────────────────────────────────
# Refresh the vendored @cms/storefront SDK bundle used for STANDALONE frontend
# builds (e.g. Vercel), where the sibling cms-ai-core repo isn't available.
#
# Rebuilds storefront in cms-ai-core and copies the single-file bundle into
# vendor/storefront/. Run after ANY change to @cms/storefront, then commit the
# updated vendor/ so the next Vercel deploy picks it up. Mirrors
# scripts/vendor-admin-base.sh exactly (same model, different package).
#
#   pnpm vendor:storefront
#
# Local dev (start.sh) does NOT use this — it links the live dist directly.
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMS_CORE_DIR="${CMS_CORE_DIR:-$(dirname "$PROJECT_DIR")/cms-ai-core}"
VENDOR_DIR="$PROJECT_DIR/vendor/storefront"

if [[ ! -d "$CMS_CORE_DIR/packages/storefront" ]]; then
  echo "Error: storefront not found at $CMS_CORE_DIR/packages/storefront" >&2
  echo "Set CMS_CORE_DIR to the cms-ai-core checkout." >&2
  exit 1
fi

echo "Building @cms/storefront in $CMS_CORE_DIR ..."
( cd "$CMS_CORE_DIR" && pnpm --filter @cms/storefront build )

echo "Copying bundle into $VENDOR_DIR/dist ..."
mkdir -p "$VENDOR_DIR/dist"
cp "$CMS_CORE_DIR/packages/storefront/dist/index.js"   "$VENDOR_DIR/dist/index.js"
cp "$CMS_CORE_DIR/packages/storefront/dist/index.d.ts" "$VENDOR_DIR/dist/index.d.ts"

echo "Done. Review & commit vendor/storefront/ to deploy the change."
