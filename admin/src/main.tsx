import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin, type PageTypeDefinition } from "@cms/admin-base";
import { productItemBlock } from "./blocks/ProductItemBlock";
import { productCategoryBlock } from "./blocks/ProductCategoryBlock";
import { aboutUsBlock } from "./blocks/AboutUsBlock";
import { cataloguesBlock } from "./blocks/CataloguesBlock";
import { featuredBannersSection } from "./settings/FeaturedBannersSection";
import { contactSection } from "./settings/ContactSection";

// product-item is a singleton-block page type: it allows exactly one block
// of type "product-item", auto-seeded on create. The framework hides
// "+ Add new section" and the per-block Remove button when
// allowedBlockTypes.length === 1.
const productItemPageType: PageTypeDefinition = {
  type: "product-item",
  label: { en: "Product", hr: "Proizvod" },
  canBeRoot: false,
  allowedParentTypes: ["product-category"],
  allowBlocks: true,
  allowedBlockTypes: ["product-item"],
};

// products is the root of the taxonomy. Originally seeded as a runtime
// singleton (limit: 1, deletable: false); now code-defined so the limit is
// lifted and instances can be deleted. Omitting `limit` means no cap. The
// code def shadows the matching runtime DB row, so this takes effect without
// touching the DB; the seed entry was updated to match.
const productsPageType: PageTypeDefinition = {
  type: "products",
  label: { en: "Products", hr: "Proizvodi" },
  deletable: true,
  canBeRoot: true,
  allowedParentTypes: [],
  allowedChildTypes: ["product-category"],
  allowBlocks: false,
};

// product-category was originally seeded as a runtime type (see
// project-data.seed.json). It's now code-defined so it can carry a
// singleton "product-category" block (alt title + main/alt image).
// A code def shadows the matching runtime DB row (PageTypeContext filters
// runtime rows whose slug clashes with a code slug), so this takes effect
// without touching the DB. All non-block properties mirror the seed entry.
const productCategoryPageType: PageTypeDefinition = {
  type: "product-category",
  label: { en: "Product category", hr: "Vrsta proizvoda" },
  deletable: true,
  canBeRoot: false,
  allowedParentTypes: ["products"],
  allowedChildTypes: ["product-item"],
  allowBlocks: true,
  allowedBlockTypes: ["product-category"],
};

// all-products is the public catalogue landing page. It collects every
// product-item across the taxonomy and renders a filterable/sortable grid on
// the frontend (see src/routes/AllProductsView.tsx). It is a singleton root
// page with no fields beyond the title, no blocks, and cannot be deleted.
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
// the page title it carries two structured images (the main article photo and a
// smaller card photo used in listings) plus an unlimited number of Mixed Content
// sections. `multiBlock: true` keeps the editor restricted to mixed-content
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
    { name: "articlePhoto", label: "Article photo", type: "image-url" },
    { name: "cardPhoto", label: "Card photo", type: "image-url" },
  ],
  allowBlocks: true,
  allowedBlockTypes: ["mixed-content"],
  multiBlock: true,
};

createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-linea",
  pageTypes: [aboutUsPageType, cataloguesPageType, allProductsPageType, productsPageType, productCategoryPageType, productItemPageType, newsPageType, articlePageType, searchPageType, cartPageType, notFoundPageType],
  blockTypes: [productItemBlock, productCategoryBlock, aboutUsBlock, cataloguesBlock],
  settingsSections: [featuredBannersSection, contactSection],
});
