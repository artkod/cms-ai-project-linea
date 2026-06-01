import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin, type PageTypeDefinition } from "@cms/admin-base";
import { productItemBlock } from "./blocks/ProductItemBlock";
import { productCategoryBlock } from "./blocks/ProductCategoryBlock";

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
};

createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-linea",
  pageTypes: [allProductsPageType, productsPageType, productCategoryPageType, productItemPageType],
  blockTypes: [productItemBlock, productCategoryBlock],
});
