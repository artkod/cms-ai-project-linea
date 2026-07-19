import { createStorefrontClient } from "@cms/storefront";

// The single @cms/storefront client for the Linea shop. Same apiUrl +
// projectSlug as lib/api.ts (the content reads); the SDK stamps X-Project-Slug
// + the contract-version header and sends credentials: "include" by default so
// the httpOnly cms_cart cookie rides along (the cart is server-side).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const storefront = createStorefrontClient({
  apiUrl: API_URL,
  projectSlug: "project-linea",
});
