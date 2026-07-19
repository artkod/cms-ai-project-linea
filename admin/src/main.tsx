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

// all-products is the public catalogue landing page — the commerce catalog
// listing anchors on it (URL `/{locale}/{this.slug}` + flat product URLs
// `/{locale}/{this.slug}/{product-slug}` resolved by the commerce URL resolver).
// Its slug/SEO stay editor-controlled. Singleton root page, no fields beyond
// the title, no blocks, not deletable. `system: true` hides it from the Pages
// tree (orange accent for developers).
const allProductsPageType: PageTypeDefinition = {
  type: "all-products",
  label: { en: "All products", hr: "Svi proizvodi" },
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
  label: { en: "About us", hr: "O nama" },
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
  label: { en: "Catalogues", hr: "Katalozi" },
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
  label: { en: "Search", hr: "Pretraga" },
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
  label: { en: "Cart", hr: "Košarica" },
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
  label: { en: "404", hr: "404" },
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
  label: { en: "News", hr: "Novosti" },
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
  label: { en: "Article", hr: "Članak" },
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
  label: { en: "EU Projects", hr: "EU Projekti" },
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
  label: { en: "EU Project", hr: "EU Projekt" },
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
  projectSlug: "project-linea",
  // Commerce module ON (must match the API's COMMERCE_ENABLED — start.sh sets it).
  // Products/categories live in the commerce catalog (shop nav).
  commerce: true,
  pageTypes: [aboutUsPageType, cataloguesPageType, allProductsPageType, newsPageType, articlePageType, euProjectsPageType, euProjectItemPageType, searchPageType, cartPageType, notFoundPageType],
  blockTypes: [aboutUsBlock, cataloguesBlock],
  settingsSections: [featuredBannersSection, contactSection, articleSection],
});
