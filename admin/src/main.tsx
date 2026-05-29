import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin, type PageTypeDefinition } from "@cms/admin-base";
import { productItemBlock } from "./blocks/ProductItemBlock";

// product-item is a singleton-block page type: it allows exactly one block
// of type "product-item", auto-seeded on create. The framework hides
// "+ Add new section" and the per-block Remove button when
// allowedBlockTypes.length === 1.
const productItemPageType: PageTypeDefinition = {
  type: "product-item",
  label: { en: "Product", hr: "Proizvod" },
  canBeRoot: false,
  allowedParentTypes: ["product-sub-category"],
  allowBlocks: true,
  allowedBlockTypes: ["product-item"],
};

createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-linea",
  pageTypes: [productItemPageType],
  blockTypes: [productItemBlock],
});
