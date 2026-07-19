// One-time cleanup AFTER the commerce migration is verified: removes the legacy
// page-based product system so the flat product URLs resolve through commerce.
//
// What it does, in one transaction:
//   1. Sanity-checks the commerce catalog exists (products table has rows) —
//      refuses to delete the legacy pages before the migration ran.
//   2. Hard-deletes every `product-item` page (page_translations / versions /
//      preview tokens cascade). The `all-products` landing page is KEPT — it's
//      the catalogue listing anchor (slug/SEO stay editor-controlled).
//   3. Deletes the `product_categories` project-setting (the taxonomy now lives
//      in commerce `categories`).
//   4. Deletes any leftover runtime `page_types` row for `product-item`.
//   5. Warns about menus that link to a deleted product page.
//
// While the pages exist they SHADOW the commerce products at
// /{locale}/svi-proizvodi/{slug} (page tree wins in the resolver) — run this
// right after the storefront cutover so those URLs flip to the commerce product
// page (same slugs were preserved by the migration).
//
//   DATABASE_URL=postgres://… node scripts/cleanup-legacy-products.mjs --dry-run
//   DATABASE_URL=postgres://… node scripts/cleanup-legacy-products.mjs

import pg from "pg";

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const PROJECT_SLUG = process.env.PROJECT_SLUG || "project-linea";
const DRY = process.argv.includes("--dry-run");

if (!DATABASE_URL) {
  console.error("DATABASE_URL env var is required.");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");

  try {
    const { rows: probe } = await client.query(
      `select coalesce((select count(*) from products), 0)::int as n
         from to_regclass('public.products') r where r is not null`
    );
    const productCount = probe[0]?.n ?? 0;
    if (productCount === 0) {
      throw new Error("Commerce catalog is empty — run migrate-products-to-commerce.mjs first.");
    }

    const { rows: pages } = await client.query(
      `select id, (select title from page_translations t where t.page_id = p.id order by locale limit 1) as title
         from pages p where p.type = 'product-item'`
    );
    const ids = pages.map((p) => p.id);

    // Menus referencing a page being deleted.
    const menuHits = [];
    if (ids.length) {
      const menus = (await client.query("SELECT id, label, items FROM menus WHERE project_slug = $1", [PROJECT_SLUG])).rows;
      for (const m of menus) {
        const txt = JSON.stringify(m.items ?? []);
        if (ids.some((id) => txt.includes(`"${id}"`))) menuHits.push(m.label);
      }
    }

    if (!DRY) {
      if (ids.length) await client.query("DELETE FROM pages WHERE id = ANY($1)", [ids]);
      await client.query(
        "DELETE FROM project_settings WHERE project_slug = $1 AND key = 'product_categories'",
        [PROJECT_SLUG]
      );
      await client.query(
        "DELETE FROM page_types WHERE project_slug = $1 AND type = 'product-item'",
        [PROJECT_SLUG]
      );
    }

    console.log("─".repeat(60));
    console.log(`${DRY ? "[DRY RUN] " : ""}Legacy product-pages cleanup`);
    console.log(`  commerce products present: ${productCount}`);
    console.log(`  product-item pages deleted: ${ids.length}`);
    console.log(`  project_settings.product_categories: deleted`);
    if (menuHits.length) {
      console.warn(`  ⚠ menus linking to deleted product pages — fix in admin: ${menuHits.join(", ")}`);
    }
    console.log("─".repeat(60));

    if (DRY) {
      await client.query("ROLLBACK");
      console.log("Dry run — rolled back, nothing written.");
    } else {
      await client.query("COMMIT");
      console.log("Done. Old /svi-proizvodi/{slug} URLs now resolve the commerce products.");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Cleanup failed — rolled back:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
