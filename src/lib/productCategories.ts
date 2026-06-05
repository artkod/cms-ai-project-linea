import type { ProductMainCategory, ProductSubcategory } from "./api";

// ─── Frontend product-category lookups ───────────────────────────────────────
//
// The flat product model keeps its two-level taxonomy in the `product_categories`
// project-setting (fetched via getProductCategories()). A product-item references
// a main category + subcategory by id on its block data. These helpers resolve
// those ids to labels/slugs for the catalogue grid, product breadcrumb and the
// related rail.

export interface ResolvedCategory {
  main: ProductMainCategory | null;
  sub: ProductSubcategory | null;
}

export function resolveLabel(
  label: Record<string, string> | undefined,
  locale: string,
  defaultLocale: string,
): string {
  if (!label) return "";
  return (
    label[locale]?.trim() ||
    label[defaultLocale]?.trim() ||
    Object.values(label).find((v) => v?.trim())?.trim() ||
    ""
  );
}

/** Build id→main and subId→{main,sub} indexes for O(1) lookups. */
export function indexCategories(categories: ProductMainCategory[]) {
  const mainById = new Map<string, ProductMainCategory>();
  const subById = new Map<string, { main: ProductMainCategory; sub: ProductSubcategory }>();
  const mainBySlug = new Map<string, ProductMainCategory>();
  for (const main of categories) {
    mainById.set(main.id, main);
    if (main.slug) mainBySlug.set(main.slug, main);
    for (const sub of main.subcategories ?? []) {
      subById.set(sub.id, { main, sub });
    }
  }
  return { mainById, subById, mainBySlug };
}

export type CategoryIndex = ReturnType<typeof indexCategories>;

export function resolveProductCategory(
  index: CategoryIndex,
  mainCategoryId: string | null | undefined,
  subcategoryId: string | null | undefined,
): ResolvedCategory {
  const subHit = subcategoryId ? index.subById.get(subcategoryId) ?? null : null;
  const main = subHit?.main ?? (mainCategoryId ? index.mainById.get(mainCategoryId) ?? null : null);
  return { main, sub: subHit?.sub ?? null };
}
