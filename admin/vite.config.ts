import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
});
