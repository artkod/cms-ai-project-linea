import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin, type PageTypeDefinition } from "@cms/admin-base";
import { aboutUsBlock } from "./blocks/AboutUsBlock";
import { cataloguesBlock } from "./blocks/CataloguesBlock";
import { featuredBannersSection } from "./settings/FeaturedBannersSection";
import { contactSection } from "./settings/ContactSection";
import { articleSection } from "./settings/ArticleSection";

// (The legacy page-based product system — `product-item` page type + block +
// the "Products" sidebar section + the `product_categories` project-setting —
// was migrated into the COMMERCE MODULE (scripts/migrate-products-to-commerce.mjs
// + cleanup-legacy-products.mjs). Products/categories are managed under the
// shop nav; the storefront reads the commerce catalog API.)

// PAGE-TYPE LABELS ARE ENGLISH-ONLY (Sandro, 2026-08-06): a `label` is a plain
// string, never a `{ en, hr }` map. A page type names a developer-defined
// content model, so it must NOT follow the topbar content-locale switch — with
// a map, the Pages tree and the dashboard Content-mix chart flipped to Croatian
// while the rest of the chrome stayed in the UI language. Same rule now holds
// for core's built-in "Default page" type.

// all-products is the public catalogue landing page — the commerce catalog
// listing anchors on it (URL `/{locale}/{this.slug}` + flat product URLs
// `/{locale}/{this.slug}/{product-slug}` resolved by the commerce URL resolver).
// Its slug/SEO stay editor-controlled. Singleton root page, no fields beyond
// the title, no blocks, not deletable. `system: true` hides it from the Pages
// tree (orange accent for developers).
const allProductsPageType: PageTypeDefinition = {
  type: "all-products",
  label: "All products",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: [],
  allowBlocks: false,
  // Developer-only frontend-route slot — hidden from the Pages tree (orange for devs).
  system: true,
};

// about-us is a singleton root page: exactly one across the site, lives at
// root, cannot be deleted, takes no parent and no children. Its content is
// authored through a singleton "about-us" block (allowedBlockTypes.length === 1),
// matching the product-item / product-category pattern — the framework
// auto-seeds one block on create and hides the Add/Remove controls so the editor
// shows a single fixed Content Section. The block (AboutUsBlock) holds an icon, a
// subtitle + description, and two buttons (label text + link target).
const aboutUsPageType: PageTypeDefinition = {
  type: "about-us",
  label: "About us",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: [],
  allowBlocks: true,
  allowedBlockTypes: ["about-us"],
};

// catalogues is a singleton root page: exactly one across the site, lives at
// root, cannot be deleted, takes no parent and no children. Its content is the
// "Katalozi" resource-library page, authored through a singleton "catalogues"
// block (allowedBlockTypes.length === 1) — the framework auto-seeds one block on
// create and hides the Add/Remove controls. The block (CataloguesBlock) holds an
// intro subtitle, a list of downloadable documents (each with a display title)
// and a contact CTA link.
const cataloguesPageType: PageTypeDefinition = {
  type: "catalogues",
  label: "Catalogues",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: [],
  allowBlocks: true,
  allowedBlockTypes: ["catalogues"],
};

// search / cart / notFound are functional singleton root pages: exactly one
// each across the site, live at root, cannot be deleted, take no parent and no
// children, and hold no authored content (allowBlocks: false). They exist only
// as page slots so the frontend can render the search results, cart, and 404
// views at a CMS-managed URL — same shape as all-products. `system: true` hides
// them from the Pages tree + New-Page picker for every role except developer
// (developers see them with an orange accent).
const searchPageType: PageTypeDefinition = {
  type: "search",
  label: "Search",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: [],
  allowBlocks: false,
  system: true,
};

const cartPageType: PageTypeDefinition = {
  type: "cart",
  label: "Cart",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: [],
  allowBlocks: false,
  system: true,
};

const notFoundPageType: PageTypeDefinition = {
  type: "404",
  label: "404",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: [],
  allowBlocks: false,
  system: true,
};

// news is the singleton root container for the article listing. Exactly one
// across the site (limit: 1), lives at root, cannot be deleted, takes no
// parent. Its only direct children are `article` pages. It holds no authored
// content beyond the title (allowBlocks: false, no fields) — the frontend
// renders the article index from its children.
const newsPageType: PageTypeDefinition = {
  type: "news",
  label: "News",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: ["article"],
  allowBlocks: false,
};

// article is a child of `news` only — never at root. Deletable, no cap. Beyond
// the page title it carries a card photo (used by the news listing) plus an
// unlimited number of Mixed Content sections (all in-article imagery lives in
// the body). `multiBlock: true` keeps the editor restricted to mixed-content
// while still allowing several sections (without it, a single allowed block type
// would make the page a singleton-block page — see PageTypeDefinition.multiBlock).
const articlePageType: PageTypeDefinition = {
  type: "article",
  label: "Article",
  deletable: true,
  canBeRoot: false,
  allowedParentTypes: ["news"],
  allowedChildTypes: [],
  fields: [
    // Options come from Settings → Article ("article" project-settings key) — an
    // admin-managed list, so editors can add types without a redeploy.
    { name: "articleType", label: "Vrsta članka", type: "select", optionsSource: "article" },
    { name: "cardPhoto", label: "Fotografija kartice", type: "image-url" },
  ],
  allowBlocks: true,
  allowedBlockTypes: ["mixed-content"],
  multiBlock: true,
};

// eu-projects is the singleton root container for the EU-project listing.
// Exactly one across the site (limit: 1), lives at root, cannot be deleted,
// takes no parent. Its only direct children are `eu-project-item` pages. It
// carries a single main photo beyond the title — the frontend renders the
// project index from its children.
const euProjectsPageType: PageTypeDefinition = {
  type: "eu-projects",
  label: "EU Projects",
  deletable: false,
  canBeRoot: true,
  limit: 1,
  allowedParentTypes: [],
  allowedChildTypes: ["eu-project-item"],
  fields: [
    { name: "mainPhoto", label: "Glavna fotografija", type: "image-url" },
  ],
  allowBlocks: false,
};

// eu-project-item is a child of `eu-projects` only — never at root. Deletable,
// no cap. Beyond the page title it carries a card photo (used by the EU-projects
// listing thumbnail) plus an unlimited number of Mixed Content sections (all
// in-project imagery lives in the body). `multiBlock: true` keeps the editor
// restricted to mixed-content while still allowing several sections (without
// it, a single allowed block type would make the page a singleton-block page).
const euProjectItemPageType: PageTypeDefinition = {
  type: "eu-project-item",
  label: "EU Project",
  deletable: true,
  canBeRoot: false,
  allowedParentTypes: ["eu-projects"],
  allowedChildTypes: [],
  fields: [
    { name: "cardPhoto", label: "Fotografija kartice", type: "image-url" },
  ],
  allowBlocks: true,
  allowedBlockTypes: ["mixed-content"],
  multiBlock: true,
};

createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  // Admin URL routing tracks the build's base path (dev "/", prod "/admin/").
  basePath: import.meta.env.BASE_URL,
  projectSlug: "project-linea",
  // Commerce module ON (must match the API's COMMERCE_ENABLED — start.sh sets it).
  // Products/categories live in the commerce catalog (shop nav).
  commerce: true,
  // TEMPORARY: hide most commerce nav for Linea — only Sales › Quotes,
  // Catalog › Products/Categories and Shop settings › Notifications stay
  // visible. UI-only hide (screens/routes untouched); remove this array to
  // restore the full commerce nav.
  //
  // Shop settings IS shown (2026-08-14) but pared down to its Notifications tab
  // — that's where the merchant sets the address inquiry/quote notices go to and
  // which of them fire. Every other tab is a capability Linea doesn't use
  // (delivery, payments, fiscalization, search) or config it must not drift
  // (tax, business letterhead). The section is developer/owner-only in core.
  hiddenCommerceNav: [
    "commerce:reports",
    "commerce:orders",
    "commerce:customers",
    "commerce:reviews",
    "commerce:price-lists",
    "commerce:discounts",
    "commerce:settings:business",
    "commerce:settings:tax",
    "commerce:settings:delivery",
    "commerce:settings:payments",
    "commerce:settings:policies",
    "commerce:settings:fiscalization",
    "commerce:settings:social",
    "commerce:settings:search",
  ],
  // Linea is an inquiry-only catalogue: nothing ships from the CMS, no returns
  // flow, no digital downloads. Hides the order detail's shipping half and the
  // returns/digital notification groups.
  hiddenCommerceFeatures: ["shipping", "returns", "digital"],
  // Linea product-model lockdown: every product is physical + inquiry-only +
  // shop-default tax, and must stay that way — hide the type/sale/tax-class/KPD
  // editors AND force those values on save, so none can drift by accident.
  // Core mechanism: DECISIONS #154 hiddenProductFields. Drop a key to restore
  // its control.
  hiddenProductFields: ["type", "sale", "taxClass", "kpdCode"],
  pageTypes: [aboutUsPageType, cataloguesPageType, allProductsPageType, newsPageType, articlePageType, euProjectsPageType, euProjectItemPageType, searchPageType, cartPageType, notFoundPageType],
  blockTypes: [aboutUsBlock, cataloguesBlock],
  settingsSections: [featuredBannersSection, contactSection, articleSection],
});
