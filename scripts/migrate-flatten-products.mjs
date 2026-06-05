// One-time migration: flatten the product taxonomy.
//
// BEFORE: products (main category folder) → product-category (subcategory folder)
//         → product-item. The two folder levels are pages with no frontend view.
// AFTER:  product-items live directly under the `all-products` landing page and
//         carry their main/sub category as ids on the product-item block data.
//         The taxonomy itself moves into the `product_categories` project-setting.
//
// What this script does, in one transaction:
//   1. Builds `product_categories` from the existing products/product-category
//      pages (id = original page id, slug = default-locale slug, label = per-locale
//      titles) and upserts it into project_settings.
//   2. For every product-item, writes mainCategoryId (grandparent `products` id) +
//      subcategoryId (parent `product-category` id) onto the product-item block in
//      EVERY locale, re-parents the page to `all-products`, and resolves any slug
//      collision under the new shared parent (appends -2, -3, …).
//   3. Hard-deletes the now-empty products + product-category pages (translations,
//      versions and preview tokens cascade) and any leftover runtime page_types rows.
//
// Run from the project root with the project DB url:
//   pnpm install            # once, to get the `pg` devDependency
//   DATABASE_URL=postgres://… node scripts/migrate-flatten-products.mjs --dry-run
//   DATABASE_URL=postgres://… node scripts/migrate-flatten-products.mjs
//
// --dry-run prints the plan and rolls back without writing.

import pg from "pg";

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const PROJECT_SLUG = process.env.PROJECT_SLUG || "project-linea";
const DRY = process.argv.includes("--dry-run");

if (!DATABASE_URL) {
  console.error("DATABASE_URL env var is required.");
  process.exit(1);
}

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  try {
    const dl =
      (await client.query("SELECT default_locale FROM site_settings LIMIT 1")).rows[0]?.default_locale || "hr";

    const ap = (
      await client.query("SELECT id FROM pages WHERE type='all-products' AND deleted_at IS NULL LIMIT 1")
    ).rows[0];
    if (!ap) throw new Error("No `all-products` page found — create it before running this migration.");
    const allProductsId = ap.id;

    const taxPages = (
      await client.query(
        "SELECT id, type, parent_id FROM pages WHERE type IN ('products','product-category','product-item') AND deleted_at IS NULL",
      )
    ).rows;
    const productsPages = taxPages.filter((p) => p.type === "products");
    const categoryPages = taxPages.filter((p) => p.type === "product-category");
    const itemPages = taxPages.filter((p) => p.type === "product-item");

    // ── 1. Build taxonomy from the folder pages' translations ──
    const taxIds = [...productsPages, ...categoryPages].map((p) => p.id);
    const taxTrans = taxIds.length
      ? (
          await client.query(
            "SELECT page_id, locale, title, slug FROM page_translations WHERE page_id = ANY($1)",
            [taxIds],
          )
        ).rows
      : [];
    const transByPage = groupBy(taxTrans, "page_id");
    const labelMap = (pageId) => {
      const m = {};
      for (const t of transByPage.get(pageId) ?? []) m[t.locale] = t.title;
      return m;
    };
    const defaultSlug = (pageId) => {
      const ts = transByPage.get(pageId) ?? [];
      return ts.find((t) => t.locale === dl)?.slug || ts[0]?.slug || "";
    };

    const categories = productsPages.map((pp) => ({
      id: pp.id,
      slug: defaultSlug(pp.id),
      label: labelMap(pp.id),
      subcategories: categoryPages
        .filter((c) => c.parent_id === pp.id)
        .map((c) => ({ id: c.id, slug: defaultSlug(c.id), label: labelMap(c.id) })),
    }));

    const catById = new Map(categoryPages.map((c) => [c.id, c]));
    const productsById = new Map(productsPages.map((p) => [p.id, p]));

    // ── Slug-collision tracking under the new shared parent ──
    const existingChildren = (
      await client.query(
        `SELECT pt.locale, pt.slug FROM page_translations pt
           JOIN pages p ON p.id = pt.page_id
          WHERE p.parent_id = $1 AND p.deleted_at IS NULL AND pt.deleted_at IS NULL`,
        [allProductsId],
      )
    ).rows;
    const usedSlugs = new Map();
    const slugSet = (loc) => {
      if (!usedSlugs.has(loc)) usedSlugs.set(loc, new Set());
      return usedSlugs.get(loc);
    };
    for (const r of existingChildren) slugSet(r.locale).add(r.slug);

    // ── 2. Backfill category + reparent every item ──
    let backfilled = 0;
    let reparented = 0;
    let slugFixes = 0;
    for (const item of itemPages) {
      const cat = item.parent_id ? catById.get(item.parent_id) : null;
      const prod = cat && cat.parent_id ? productsById.get(cat.parent_id) : null;
      const mainCategoryId = prod ? prod.id : null;
      const subcategoryId = cat ? cat.id : null;

      const itrs = (
        await client.query("SELECT id, locale, slug, blocks FROM page_translations WHERE page_id = $1", [item.id])
      ).rows;
      for (const tr of itrs) {
        const set = slugSet(tr.locale);
        let slug = tr.slug;
        if (set.has(slug)) {
          let n = 2;
          while (set.has(`${slug}-${n}`)) n++;
          slug = `${slug}-${n}`;
          slugFixes++;
        }
        set.add(slug);

        const blocks = Array.isArray(tr.blocks) ? tr.blocks : [];
        for (const b of blocks) {
          if (b && b.type === "product-item") {
            b.data = { ...(b.data || {}), mainCategoryId, subcategoryId };
            backfilled++;
          }
        }

        if (!DRY) {
          await client.query(
            "UPDATE page_translations SET blocks = $1::jsonb, slug = $2, parent_id = $3, updated_at = now() WHERE id = $4",
            [JSON.stringify(blocks), slug, allProductsId, tr.id],
          );
        }
      }
      if (!DRY) {
        await client.query("UPDATE pages SET parent_id = $1, updated_at = now() WHERE id = $2", [allProductsId, item.id]);
      }
      reparented++;
    }

    // ── Warn about menus pointing at the folder pages we're about to delete ──
    const delIds = [...categoryPages, ...productsPages].map((p) => p.id);
    if (delIds.length) {
      const menuHits = [];
      const menus = (await client.query("SELECT id, label, items FROM menus")).rows;
      for (const m of menus) {
        const txt = JSON.stringify(m.items ?? []);
        if (delIds.some((id) => txt.includes(`"${id}"`))) menuHits.push(m.label);
      }
      if (menuHits.length) {
        console.warn(
          `⚠  These menus link to a products/product-category page being deleted — fix them after migrating: ${menuHits.join(", ")}`,
        );
      }
    }

    // ── 1b. Persist the taxonomy ──
    if (!DRY) {
      await client.query(
        `INSERT INTO project_settings (project_slug, key, value, version)
           VALUES ($1, 'product_categories', $2::jsonb, 1)
         ON CONFLICT (project_slug, key)
           DO UPDATE SET value = EXCLUDED.value, version = project_settings.version + 1, updated_at = now()`,
        [PROJECT_SLUG, JSON.stringify({ categories })],
      );
    }

    // ── 3. Delete the folder pages + leftover runtime page-type rows ──
    if (delIds.length && !DRY) {
      await client.query("DELETE FROM pages WHERE id = ANY($1)", [delIds]);
    }
    if (!DRY) {
      await client.query("DELETE FROM page_types WHERE project_slug = $1 AND type IN ('products','product-category')", [
        PROJECT_SLUG,
      ]);
    }

    console.log("─".repeat(60));
    console.log(`${DRY ? "[DRY RUN] " : ""}Flatten products migration`);
    console.log(`  default locale:        ${dl}`);
    console.log(`  all-products page:     ${allProductsId}`);
    console.log(`  main categories:       ${categories.length}`);
    console.log(`  subcategories:         ${categories.reduce((n, c) => n + c.subcategories.length, 0)}`);
    console.log(`  product items moved:   ${reparented}`);
    console.log(`  block category writes: ${backfilled}`);
    console.log(`  slug collisions fixed: ${slugFixes}`);
    console.log(`  folder pages deleted:  ${delIds.length}`);
    console.log("─".repeat(60));

    if (DRY) {
      await client.query("ROLLBACK");
      console.log("Dry run — rolled back, nothing written.");
    } else {
      await client.query("COMMIT");
      console.log("Done.");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed — rolled back.");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
