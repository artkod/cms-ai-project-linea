// One-time migration: legacy page-based products → the commerce module catalog.
//
// BEFORE: 98 `product-item` pages (all product data on one `product-item` block
//         per locale) + a 2-level taxonomy in the `product_categories`
//         project-setting + the "Products" admin nav section.
// AFTER:  commerce `categories` (main → sub) + `products` with per-locale
//         content (name = page TITLE, shortDescription = altTitle SUBTITLE,
//         SEO, the plain-text description as a Mixed Content TEXT section +
//         the info tabs as a Mixed Content ACCORDION) + a shared gallery +
//         option axes / variants:
//
//   • fixed price      → one default variant, price = priceEur (cents)
//   • inquiry-only     → one default variant, price = 0 (storefront: "Na upit")
//   • configurator     → up to 3 option axes (konstrukcija / grafika / baza,
//     labelled per locale from group1..3Label; flat-priced rows keep their
//     per-row price as a DISPLAY HINT on option_values.price — core #150 —
//     so the storefront picker shows the legacy per-element prices; grafika's
//     matrix prices derive at render time) and one variant per combination,
//     price = konstrukcija.cijena + grafika.cijene[konstrukcijaId] + baza.cijena.
//     An empty flat price contributes 0 (e.g. Roll Up pregrada, where the real
//     money sits on the grafika matrix); a MISSING grafika matrix cell means the
//     combination isn't offered → that variant is skipped (e.g. Šatori, where
//     duplicate grafika rows each price a different konstrukcija subset).
//     Duplicate row names within an axis get a " (2)" suffix on the canonical
//     value (they'd collide as variant-matrix keys) — flagged for cleanup.
//
// EVERY product is created `purchasable = false` (inquiry-only shop — checkout
// always lands as a quote; flipping to real payments later = per-product
// SegmentedControl + payment-provider config, no data migration). All variants
// are `inventory_tracked = false` (unlimited — nothing tracked stock before).
// Page status carries over (published → active, draft → draft); a locale is
// included only where the page translation is active + non-deleted (same
// visibility the site has today). Slugs are preserved VERBATIM so existing
// `/{locale}/svi-proizvodi/{slug}` URLs keep resolving (the commerce resolver
// matches products by last path segment).
//
// UUID reuse (traceability + stable cross-locale wiring): product id = the old
// page id; category id = the taxonomy entry id; option-value id = the
// configurator row id (identical across locales — verified). Option-axis ids
// are freshly generated.
//
// This script only WRITES the commerce catalog — the legacy pages / page types /
// project-setting stay untouched (removed later by cleanup-legacy-products.mjs
// once the storefront cutover is verified). It refuses to run if the commerce
// catalog already has rows (wipe `products`/`categories` first to re-run).
//
// Run from the project root with the project DB url:
//   DATABASE_URL=postgres://… node scripts/migrate-products-to-commerce.mjs --dry-run
//   DATABASE_URL=postgres://… node scripts/migrate-products-to-commerce.mjs
//
// SOURCE: reads the legacy pages + taxonomy from the LIVE DB by default. Set
// SNAPSHOT_FILE=/path/to/db-snapshot.json to read them from a committed
// snapshot instead — for re-running after cleanup-legacy-products.mjs already
// deleted the pages (writes still go to DATABASE_URL).
//
// --dry-run prints the full plan + warnings and rolls back without writing.
// After a real run, restart the API (its boot pass rebuilds the product_search
// FTS index for the new catalog).

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const PROJECT_SLUG = process.env.PROJECT_SLUG || "project-linea";
const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE || "";
const DRY = process.argv.includes("--dry-run");

if (!DATABASE_URL) {
  console.error("DATABASE_URL env var is required.");
  process.exit(1);
}

const warnings = [];
const warn = (msg) => warnings.push(msg);

// "12.34" | "12,34" | "" → integer cents (empty/invalid → null).
function parseCents(raw) {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

const eur = (cents) => (cents / 100).toFixed(2).replace(".", ",") + " €";

// Cartesian product of value arrays: [[a,b],[x]] → [[a,x],[b,x]].
function cartesian(axes) {
  return axes.reduce((acc, vals) => acc.flatMap((combo) => vals.map((v) => [...combo, v])), [[]]);
}

// One Mixed Content section holding a single TEXT widget — the legacy
// plain-text product description, one paragraph per line.
function textSection(text) {
  const paragraphs = String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ type: "paragraph", content: [{ type: "text", text: line }] }));
  return {
    type: "mixed-content",
    data: {
      layout: [12],
      columns: [
        {
          id: randomUUID(),
          width: 12,
          widgets: [{ id: randomUUID(), type: "text", data: { json: { type: "doc", content: paragraphs } } }],
        },
      ],
    },
  };
}

// One Mixed Content section holding a single accordion widget (the admin's
// product Content tab edits exactly this shape).
function accordionSection(items) {
  return {
    type: "mixed-content",
    data: {
      layout: [12],
      columns: [
        {
          id: randomUUID(),
          width: 12,
          widgets: [{ id: randomUUID(), type: "accordion", data: { items } }],
        },
      ],
    },
  };
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");

  try {
    // ── 0. Preconditions ─────────────────────────────────────────────────────
    const { rows: probe } = await client.query(`select to_regclass('public.products')::text as t`);
    if (!probe[0].t) {
      throw new Error("Commerce tables don't exist — boot the stack once with COMMERCE_ENABLED=true first.");
    }
    const { rows: existing } = await client.query(
      `select (select count(*) from products)::int as p, (select count(*) from categories)::int as c`
    );
    if (existing[0].p > 0 || existing[0].c > 0) {
      throw new Error(
        `Commerce catalog is not empty (${existing[0].p} products, ${existing[0].c} categories) — refusing to run.`
      );
    }

    // ── 1. Taxonomy → commerce categories ────────────────────────────────────
    const snapshot = SNAPSHOT_FILE ? JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) : null;
    let taxonomy;
    if (snapshot) {
      const ps = (snapshot.projectSettings ?? []).find((r) => r.key === "product_categories");
      taxonomy = ps?.value?.categories ?? [];
    } else {
      const { rows: psRows } = await client.query(
        `select value from project_settings where project_slug = $1 and key = 'product_categories'`,
        [PROJECT_SLUG]
      );
      taxonomy = psRows[0]?.value?.categories ?? [];
    }
    if (!taxonomy.length) throw new Error("project_settings.product_categories is empty — nothing to migrate.");

    const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));
    const catIdMap = new Map(); // old taxonomy id → commerce category uuid
    const catInserts = [];
    let sort = 0;
    for (const main of taxonomy) {
      const mainId = isUuid(main.id) ? main.id : randomUUID();
      catIdMap.set(main.id, mainId);
      catInserts.push({
        id: mainId,
        parentId: null,
        sortOrder: sort++,
        translations: {
          hr: { label: main.label?.hr || main.label?.en || main.slug, slug: main.slug },
          en: { label: main.label?.en || main.label?.hr || main.slug, slug: main.slug },
        },
      });
      let subSort = 0;
      for (const sub of main.subcategories ?? []) {
        const subId = isUuid(sub.id) ? sub.id : randomUUID();
        catIdMap.set(sub.id, subId);
        catInserts.push({
          id: subId,
          parentId: mainId,
          sortOrder: subSort++,
          translations: {
            hr: { label: sub.label?.hr || sub.label?.en || sub.slug, slug: sub.slug },
            en: { label: sub.label?.en || sub.label?.hr || sub.slug, slug: sub.slug },
          },
        });
      }
    }

    // ── 2. Load the product pages ─────────────────────────────────────────────
    let pageRows;
    if (snapshot) {
      const pagesById = new Map(
        (snapshot.pages ?? []).filter((p) => p.type === "product-item" && !p.deletedAt).map((p) => [p.id, p])
      );
      pageRows = (snapshot.pageTranslations ?? [])
        .filter((t) => pagesById.has(t.pageId) && !t.deletedAt)
        .map((t) => ({
          id: t.pageId,
          status: pagesById.get(t.pageId).status,
          created_at: pagesById.get(t.pageId).createdAt,
          locale: t.locale,
          title: t.title,
          slug: t.slug,
          active: t.active,
          meta_title: t.metaTitle ?? null,
          meta_description: t.metaDescription ?? null,
          blocks: t.blocks ?? [],
        }))
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.locale.localeCompare(b.locale));
    } else {
      pageRows = (
        await client.query(
          `select p.id, p.status,
                  t.locale, t.title, t.slug, t.active, t.meta_title, t.meta_description, t.blocks
             from pages p
             join page_translations t on t.page_id = p.id and t.deleted_at is null
            where p.type = 'product-item' and p.deleted_at is null
            order by p.created_at asc, t.locale asc`
        )
      ).rows;
    }
    const byPage = new Map();
    for (const r of pageRows) {
      if (!byPage.has(r.id)) byPage.set(r.id, { id: r.id, status: r.status, locales: {} });
      byPage.get(r.id).locales[r.locale] = r;
    }
    if (!byPage.size) throw new Error("No product-item pages found — nothing to migrate.");

    // ── 3. Build products + options + values + variants + memberships ────────
    const productInserts = [];
    const optionInserts = [];
    const valueInserts = [];
    const variantInserts = [];
    const membershipInserts = [];
    const planLines = [];
    const stats = { fixed: 0, inquiry: 0, configurator: 0, variants: 0, skippedCombos: 0 };

    for (const page of byPage.values()) {
      // Canonical (structure/price) locale: hr, else whichever exists.
      const base = page.locales.hr ?? Object.values(page.locales)[0];
      const block = (base.blocks ?? []).find((b) => b.type === "product-item");
      if (!block) {
        warn(`"${base.title}" (${page.id}): no product-item block — SKIPPED`);
        continue;
      }
      const d = block.data ?? {};
      const blockOf = (locale) => (page.locales[locale]?.blocks ?? []).find((b) => b.type === "product-item")?.data ?? null;

      // Per-locale content — only locales whose translation is active (today's
      // public visibility). Cross-check: konfigurator row ids are identical
      // across locales, so the EN block only contributes labels.
      const translations = {};
      for (const [locale, t] of Object.entries(page.locales)) {
        if (!t.active) continue;
        const ld = blockOf(locale) ?? d;
        const tabs = (ld.additionalInfo?.tabs ?? []).filter((tab) => tab.content != null);
        const description = String(ld.description ?? "").trim();
        const blocks = [];
        // Description first (rendered as the "O proizvodu" section), tabs after.
        if (description) blocks.push(textSection(description));
        if (tabs.length) blocks.push(accordionSection(tabs.map((tab) => ({ id: tab.id, title: tab.title, content: tab.content }))));
        translations[locale] = {
          name: t.title, // the display H1 — the legacy page title
          slug: t.slug, // verbatim — keeps /{locale}/svi-proizvodi/{slug} resolving
          // The legacy altTitle was the SUBTITLE under the H1 — shortDescription
          // carries it (also shown as the card byline on the listing).
          ...((ld.altTitle ?? "").trim() ? { shortDescription: (ld.altTitle ?? "").trim() } : {}),
          ...(t.meta_title ? { metaTitle: t.meta_title } : {}),
          ...(t.meta_description ? { metaDescription: t.meta_description } : {}),
          blocks,
        };
      }
      if (!Object.keys(translations).length) {
        warn(`"${base.title}" (${page.id}): no ACTIVE translation — created as draft with all locales`);
        for (const [locale, t] of Object.entries(page.locales)) {
          const ld = blockOf(locale) ?? d;
          translations[locale] = { name: t.title, slug: t.slug, blocks: [] };
        }
      }
      const status = page.status === "published" && Object.values(page.locales).some((t) => t.active) ? "active" : "draft";
      const displayName = translations.hr?.name ?? Object.values(translations)[0].name;

      // Shared gallery (identical across locales — verified): mainPhoto first.
      const gallery = [d.mainPhoto, ...(d.galleryImages ?? [])]
        .filter((img) => img?.mediaId && img?.cdnUrl)
        .map((img) => ({ mediaId: img.mediaId, cdnUrl: img.cdnUrl }));

      productInserts.push({
        id: page.id, // product id = old page id (traceability)
        status,
        translations,
        gallery,
      });

      // Category memberships: subcategory = primary (canonical path main/sub/slug),
      // main linked too; main-only products get main as primary.
      const mainCat = d.mainCategoryId ? catIdMap.get(d.mainCategoryId) : null;
      const subCat = d.subcategoryId ? catIdMap.get(d.subcategoryId) : null;
      if (d.mainCategoryId && !mainCat) warn(`"${displayName}": unknown mainCategoryId ${d.mainCategoryId} — membership dropped`);
      if (d.subcategoryId && !subCat) warn(`"${displayName}": unknown subcategoryId ${d.subcategoryId} — membership dropped`);
      let pos = 0;
      if (subCat) membershipInserts.push({ productId: page.id, categoryId: subCat, isPrimary: true, position: pos++ });
      if (mainCat) membershipInserts.push({ productId: page.id, categoryId: mainCat, isPrimary: !subCat, position: pos++ });
      if (!mainCat && !subCat) warn(`"${displayName}": no category — product sits at its bare slug`);

      // ── Pricing ────────────────────────────────────────────────────────────
      const kf = d.konfiguratorCijene ?? {};
      const kfEnabled = typeof kf.enabled === "boolean" ? kf.enabled : (kf.konstrukcija ?? []).length > 0;
      const groups = [
        { key: "konstrukcija", labelKey: "group1Label", rows: kf.konstrukcija ?? [] },
        { key: "grafika", labelKey: "group2Label", rows: kf.grafika ?? [] },
        { key: "baza", labelKey: "group3Label", rows: kf.baza ?? [] },
      ].filter((g) => g.rows.length > 0);

      if (!kfEnabled || !groups.length) {
        // Fixed price or inquiry-only → one default variant.
        const cents = parseCents(d.priceEur) ?? 0;
        variantInserts.push({
          id: randomUUID(),
          productId: page.id,
          price: cents,
          isDefault: true,
          optionValues: {},
          position: 0,
        });
        stats[cents > 0 ? "fixed" : "inquiry"]++;
        stats.variants++;
        planLines.push(`  ${displayName} — ${cents > 0 ? `fixed ${eur(cents)}` : "inquiry-only (Na upit)"}`);
        continue;
      }

      // Configurator → option axes + cartesian variants.
      const axes = [];
      for (const g of groups) {
        const label = String(kf[g.labelKey] ?? "").trim() || { konstrukcija: "Konstrukcija", grafika: "Grafika", baza: "Baza" }[g.key];
        const labelI18n = {};
        for (const locale of Object.keys(page.locales)) {
          const ld = blockOf(locale)?.konfiguratorCijene;
          const l = String(ld?.[g.labelKey] ?? "").trim();
          if (l) labelI18n[locale] = l;
        }
        const optionId = randomUUID();
        optionInserts.push({
          id: optionId,
          productId: page.id,
          name: label, // canonical = HR label (the variant-matrix key)
          nameI18n: labelI18n,
          position: axes.length,
        });

        const seenValues = new Set();
        const values = g.rows.map((row, i) => {
          let canonical = String(row.naziv ?? "").trim() || `Opcija ${i + 1}`;
          let candidate = canonical;
          let n = 2;
          while (seenValues.has(candidate.toLowerCase())) {
            candidate = `${canonical} (${n++})`;
          }
          if (candidate !== canonical) {
            warn(`"${displayName}" / ${label}: duplicate value "${canonical}" → renamed to "${candidate}" (review in admin)`);
          }
          seenValues.add(candidate.toLowerCase());
          const valueI18n = {};
          for (const locale of Object.keys(page.locales)) {
            const lrow = (blockOf(locale)?.konfiguratorCijene?.[g.key] ?? []).find((r) => r.id === row.id);
            const lv = String(lrow?.naziv ?? "").trim();
            if (lv && lv !== candidate) valueI18n[locale] = lv;
          }
          const valueId = isUuid(row.id) ? row.id : randomUUID();
          // Display-only per-value price hint (core #150): flat-priced rows
          // (konstrukcija/baza) keep their legacy per-row price; grafika is
          // matrix-priced (per konstrukcija) → no static hint, the storefront
          // derives it from the variant totals.
          const priceHint = g.key === "grafika" ? null : parseCents(row.cijena);
          valueInserts.push({ id: valueId, optionId, value: candidate, valueI18n, price: priceHint, position: i });
          return { valueId, row, group: g.key };
        });
        axes.push({ optionId, key: g.key, values });
      }

      // Price a combination; null = combination not offered (missing matrix cell).
      const konstrukcijaAxis = axes.find((a) => a.key === "konstrukcija");
      const priceCombo = (combo) => {
        let total = 0;
        const selectedK = combo.find((c) => c.group === "konstrukcija");
        for (const c of combo) {
          if (c.group === "grafika") {
            if (konstrukcijaAxis && selectedK) {
              const cell = c.row.cijene?.[selectedK.row.id];
              const cents = parseCents(cell);
              if (cents == null) return null; // not offered for this konstrukcija
              total += cents;
            } else {
              // No konstrukcija axis → a grafika row prices via its single cell (if any).
              const cells = Object.values(c.row.cijene ?? {});
              total += parseCents(cells[0]) ?? 0;
            }
          } else {
            total += parseCents(c.row.cijena) ?? 0; // empty flat price contributes 0
          }
        }
        return total;
      };

      const combos = cartesian(axes.map((a) => a.values));
      let created = 0;
      let cheapest = null;
      const productVariantRows = [];
      for (const combo of combos) {
        const price = priceCombo(combo);
        if (price == null) {
          stats.skippedCombos++;
          continue;
        }
        const optionValues = {};
        combo.forEach((c, i) => {
          optionValues[axes[i].optionId] = c.valueId;
        });
        const rowOut = {
          id: randomUUID(),
          productId: page.id,
          price,
          isDefault: false,
          optionValues,
          position: created++,
        };
        productVariantRows.push(rowOut);
        if (!cheapest || price < cheapest.price) cheapest = rowOut;
      }
      if (!productVariantRows.length) {
        warn(`"${displayName}": configurator produced NO priceable combination — falling back to a single inquiry variant`);
        // Drop this product's axes again (they'd be dead weight without variants).
        for (const a of axes) {
          const oi = optionInserts.findIndex((o) => o.id === a.optionId);
          if (oi >= 0) optionInserts.splice(oi, 1);
        }
        for (let i = valueInserts.length - 1; i >= 0; i--) {
          if (axes.some((a) => a.optionId === valueInserts[i].optionId)) valueInserts.splice(i, 1);
        }
        variantInserts.push({ id: randomUUID(), productId: page.id, price: 0, isDefault: true, optionValues: {}, position: 0 });
        stats.inquiry++;
        stats.variants++;
        continue;
      }
      cheapest.isDefault = true; // default = cheapest combo (mirrors the "Već od" card price)
      variantInserts.push(...productVariantRows);
      stats.configurator++;
      stats.variants += productVariantRows.length;
      const skipped = combos.length - productVariantRows.length;
      planLines.push(
        `  ${displayName} — configurator: ${axes.map((a) => `${a.key}(${a.values.length})`).join(" × ")} → ${productVariantRows.length} variants` +
          (skipped ? ` (${skipped} unpriced combos skipped)` : "") +
          `, from ${eur(cheapest.price)}`
      );
    }

    // ── 4. Write ──────────────────────────────────────────────────────────────
    for (const c of catInserts) {
      await client.query(
        `insert into categories (id, parent_id, translations, sort_order) values ($1, $2, $3, $4)`,
        [c.id, c.parentId, JSON.stringify(c.translations), c.sortOrder]
      );
    }
    for (const p of productInserts) {
      await client.query(
        `insert into products (id, type, status, purchasable, translations, gallery)
         values ($1, 'physical', $2, false, $3, $4)`,
        [p.id, p.status, JSON.stringify(p.translations), JSON.stringify(p.gallery)]
      );
    }
    for (const o of optionInserts) {
      await client.query(
        `insert into product_options (id, product_id, name, name_i18n, position) values ($1, $2, $3, $4, $5)`,
        [o.id, o.productId, o.name, JSON.stringify(o.nameI18n), o.position]
      );
    }
    for (const v of valueInserts) {
      await client.query(
        `insert into option_values (id, option_id, value, value_i18n, price, position) values ($1, $2, $3, $4, $5, $6)`,
        [v.id, v.optionId, v.value, JSON.stringify(v.valueI18n), v.price, v.position]
      );
    }
    for (const v of variantInserts) {
      await client.query(
        `insert into product_variants (id, product_id, price, is_default, inventory_tracked, backorder, on_hand, option_values, position)
         values ($1, $2, $3, $4, false, false, 0, $5, $6)`,
        [v.id, v.productId, v.price, v.isDefault, JSON.stringify(v.optionValues), v.position]
      );
    }
    for (const m of membershipInserts) {
      await client.query(
        `insert into product_categories (product_id, category_id, is_primary, position) values ($1, $2, $3, $4)`,
        [m.productId, m.categoryId, m.isPrimary, m.position]
      );
    }

    // ── 5. Report ─────────────────────────────────────────────────────────────
    console.log(`\nPlan (${DRY ? "DRY RUN — rolling back" : "APPLIED"}):`);
    console.log(planLines.join("\n"));
    console.log(`\nTotals:`);
    console.log(`  categories:        ${catInserts.length} (${taxonomy.length} main)`);
    console.log(`  products:          ${productInserts.length} (fixed ${stats.fixed} / inquiry ${stats.inquiry} / configurator ${stats.configurator})`);
    console.log(`  option axes:       ${optionInserts.length}`);
    console.log(`  option values:     ${valueInserts.length}`);
    console.log(`  variants:          ${stats.variants} (${stats.skippedCombos} unpriced combos skipped)`);
    console.log(`  memberships:       ${membershipInserts.length}`);
    if (warnings.length) {
      console.log(`\nWarnings (${warnings.length}):`);
      for (const w of warnings) console.log(`  ⚠ ${w}`);
    }

    if (DRY) {
      await client.query("ROLLBACK");
      console.log("\nDry run complete — no changes written.");
    } else {
      await client.query("COMMIT");
      console.log("\nMigration committed. Restart the API so the product_search FTS index is rebuilt.");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\nMigration failed — rolled back:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
