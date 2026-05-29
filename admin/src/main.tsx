import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";
import { createAdmin } from "@cms/admin-base";
import { productItemBlock } from "./blocks/ProductItemBlock";

createAdmin({
  apiUrl: import.meta.env.VITE_API_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL,
  projectSlug: "project-linea",
  blockTypes: [productItemBlock],
});
