import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite pre-bundles @cms/admin-base into node_modules/.vite/deps and serves the
// chunk as `…?v=<browserHash>` with `Cache-Control: immutable`. That hash is
// derived from the lockfile + this config — NEVER from the dependency's content
// — so after start.sh hot-syncs a rebuilt admin-base dist the URL is unchanged
// and the browser keeps serving the STALE chunk from its HTTP cache until a
// hard refresh (an already-fixed admin bug "coming back"). Folding the dist's
// content hash into esbuildOptions (part of Vite's config hash) gives every
// rebuild a fresh `?v=` URL. Core DECISIONS 221.
function adminBaseContentHash(): string {
  try {
    const dist = fileURLToPath(new URL("./node_modules/@cms/admin-base/dist/index.js", import.meta.url));
    return createHash("sha1").update(readFileSync(dist)).digest("hex").slice(0, 12);
  } catch {
    return "missing";
  }
}

export default defineConfig({
  // The admin is always served under /admin (prod: the Opalstack site route +
  // nginx alias; dev: this base, so localhost:PORT/admin matches prod and
  // `import.meta.env.BASE_URL` — which feeds createAdmin({ basePath }) and the
  // URL router — is "/admin/" in BOTH environments. The deploy workflow still
  // passes --base=/admin/ explicitly; same value, kept for clarity.
  base: "/admin/",
  plugins: [react()],
  server: {
    port: parseInt(process.env.ADMIN_PORT || "5174"),
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { __CMS_ADMIN_BASE_HASH__: JSON.stringify(adminBaseContentHash()) },
    },
  },
});
