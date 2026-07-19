import { createStorefrontClient } from "@cms/storefront";

// The single @cms/storefront client for the Linea shop. Same apiUrl env var +
// projectSlug as lib/api.ts (the content reads) — VITE_CMS_API_URL is what both
// start.sh and the deploy workflow set for the FRONTEND build (VITE_API_URL is
// the admin's). The SDK stamps X-Project-Slug + the contract-version header and
// sends credentials: "include" so the httpOnly cms_cart cookie rides along.
const API_URL = import.meta.env.VITE_CMS_API_URL || "http://localhost:3001";

export const storefront = createStorefrontClient({
  apiUrl: API_URL,
  projectSlug: "project-linea",
});
