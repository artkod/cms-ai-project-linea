#!/usr/bin/env bash
set -euo pipefail
# ─────────────────────────────────────────────────────────────────────────────
# Refresh the vendored @cms/admin-base bundle used for STANDALONE admin builds
# (e.g. Vercel), where the sibling cms-ai-core repo isn't available.
#
# Rebuilds admin-base in cms-ai-core and copies the single-file bundle into
# admin/vendor/admin-base/. Run after ANY change to admin-base, then commit the
# updated vendor/ so the next Vercel deploy picks it up.
#
#   pnpm vendor:admin-base      (from cms-ai-project-linea)
#
# Local dev (start.sh) does NOT use this — it links the live dist directly.
# ─────────────────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CMS_CORE_DIR="${CMS_CORE_DIR:-$(dirname "$PROJECT_DIR")/cms-ai-core}"
VENDOR_DIR="$PROJECT_DIR/admin/vendor/admin-base"

if [[ ! -d "$CMS_CORE_DIR/packages/admin-base" ]]; then
  echo "Error: admin-base not found at $CMS_CORE_DIR/packages/admin-base" >&2
  echo "Set CMS_CORE_DIR to the cms-ai-core checkout." >&2
  exit 1
fi

echo "Building @cms/admin-base in $CMS_CORE_DIR ..."
( cd "$CMS_CORE_DIR" && pnpm --filter @cms/admin-base build )

echo "Copying bundle into $VENDOR_DIR/dist ..."
mkdir -p "$VENDOR_DIR/dist"
cp "$CMS_CORE_DIR/packages/admin-base/dist/index.js"   "$VENDOR_DIR/dist/index.js"
cp "$CMS_CORE_DIR/packages/admin-base/dist/index.d.ts" "$VENDOR_DIR/dist/index.d.ts"

echo "Done. Review & commit admin/vendor/admin-base/ to deploy the change."
