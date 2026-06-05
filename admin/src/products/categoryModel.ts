// ─── Product category taxonomy (admin side) ─────────────────────────────────
//
// The flat product model (no more product/product-category folder pages) keeps
// its two-level taxonomy as plain data in the generic project-settings store
// under the key `product_categories`:
//
//   { categories: [ { id, slug, label:{hr,en}, subcategories:[ { id, slug, label:{hr,en} } ] } ] }
//
// A product-item references a main category + subcategory by **id** (stable
// across renames) on its block data (mainCategoryId / subcategoryId). Slugs are
// kept for deep-links (e.g. AllProductsView's `?kategorija=<slug>`) and stay
// stable once created. Labels are per-locale.
//
// This module is shared by the Products screen (taxonomy editor + table) and the
// ProductItemBlock cascading dropdowns. The public frontend has its own tiny
// resolver (src/lib/productCategories.ts) over the same JSON shape.

export const PRODUCT_CATEGORIES_KEY = "product_categories";

export type LocaleLabel = Record<string, string>;

export interface Subcategory {
  id: string;
  slug: string;
  label: LocaleLabel;
}

export interface MainCategory {
  id: string;
  slug: string;
  label: LocaleLabel;
  subcategories: Subcategory[];
}

export interface ProductCategoriesValue {
  categories: MainCategory[];
}

export const EMPTY_CATEGORIES: ProductCategoriesValue = { categories: [] };

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** kebab-case slug from a label (Croatian diacritics folded to ASCII). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Resolve a per-locale label with a defaultLocale fallback, then any non-empty. */
export function resolveCatLabel(
  label: LocaleLabel | undefined,
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

/** Coerce arbitrary stored JSON into the full ProductCategoriesValue shape. */
export function normalizeCategories(raw: unknown): ProductCategoriesValue {
  const r = (raw ?? {}) as Partial<ProductCategoriesValue>;
  const cats = Array.isArray(r.categories) ? r.categories : [];
  return {
    categories: cats.map((c) => {
      const cc = (c ?? {}) as Partial<MainCategory>;
      const subs = Array.isArray(cc.subcategories) ? cc.subcategories : [];
      return {
        id: typeof cc.id === "string" && cc.id ? cc.id : uid(),
        slug: typeof cc.slug === "string" ? cc.slug : "",
        label: (cc.label ?? {}) as LocaleLabel,
        subcategories: subs.map((s) => {
          const ss = (s ?? {}) as Partial<Subcategory>;
          return {
            id: typeof ss.id === "string" && ss.id ? ss.id : uid(),
            slug: typeof ss.slug === "string" ? ss.slug : "",
            label: (ss.label ?? {}) as LocaleLabel,
          };
        }),
      };
    }),
  };
}

/** Find a main category by id. */
export function findMain(value: ProductCategoriesValue, id: string | null | undefined): MainCategory | null {
  if (!id) return null;
  return value.categories.find((c) => c.id === id) ?? null;
}

/** Find a subcategory (and its parent main) by subcategory id. */
export function findSub(
  value: ProductCategoriesValue,
  subId: string | null | undefined,
): { main: MainCategory; sub: Subcategory } | null {
  if (!subId) return null;
  for (const main of value.categories) {
    const sub = main.subcategories.find((s) => s.id === subId);
    if (sub) return { main, sub };
  }
  return null;
}
