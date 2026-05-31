# Runbook — migrating product content from the old Linea CMS

This documents how the 98 `product-item` pages were populated from the legacy
Linea CMS dump, so the same job (or a re-run / extension) can be done quickly.
Written for "future Claude" — it captures the dead-ends too, not just the happy path.

> **TL;DR of the model:** the source is the **`lineahr_cms3.sql`** dump (a `kh_cms_*`
> CMS). Each new `product-item` page maps 1:1 to an old `product` page **by URL path**.
> Text + configurator come from the dump; per-product galleries come from the dump's
> `product_gallery` field; tab content from the product's child `product-tab` pages;
> images resolve to media already uploaded in this project **by a filename hash**.

---

## 0. Which dump is the right one

There were **two** dumps. Don't repeat my mistake:

| File | What it is | Use it? |
|---|---|---|
| `lineahr_linea.sql` | An **old shop CMS** (`shop_product`, `shop_category`, vinyl-wrap SKUs, `opt=shop&act=catlist` URLs). Predates the current site. | ❌ NO — only ~23/98 titles even fuzzy-match, no configurator data, all prices `0`. |
| `lineahr_cms3.sql` | The **`kh_cms_*` CMS** behind the current live linea.hr (clean hierarchical URLs, `product` / `product-tab` / `category` / `top-category` page types). | ✅ YES — 97/98 products match by path; has descriptions, configurator, tabs, galleries. |

Sanity check after loading: `SELECT type, COUNT(*) FROM kh_cms_page_custom_index GROUP BY type;`
should show `product` ≈ 109, `product-tab` ≈ 276, `category`, `top-category`.

The new admin tree is a faithful rebuild of the **live** linea.hr structure (same
names + hierarchy), which is why path-matching works.

---

## 1. Tooling / environment gotchas

- **No local mysql client.** Load the dump into a throwaday container:
  ```bash
  docker run -d --name linea-mysql-migrate -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8
  # wait for: docker exec linea-mysql-migrate mysqladmin ping -h localhost --silent
  docker exec linea-mysql-migrate mysql -e "CREATE DATABASE cms3 CHARACTER SET utf8mb4;"
  docker exec -i linea-mysql-migrate mysql cms3 < /path/to/lineahr_cms3.sql
  ```
  If the import errors with "Server shutdown in progress", the server was still
  starting — `docker rm -f` and recreate, wait longer, retry.
- **Croatian diacritics:** the data is real UTF-8 but the mysql CLI mangles it unless
  you pass `--default-character-set=utf8mb4` on **every** query. (The raw `.sql` file
  already contains correct `č/ć/š/ž`.)
- **Extracting JSON from `longtext`:** use `mysql --raw -N` — without `--raw`, mysql
  **double-escapes** backslashes (`\"` → `\\"`) and the JSON won't parse.
- **`specific` is a reserved word** in MySQL 8 (only relevant to the old shop dump) —
  backtick it.
- **New project Postgres** is the running Docker container `cms-ai-project-linea-db-1`
  (`psql -U cms -d project_linea`).
- The harness sometimes reports the temp filesystem as "0 MB free" — it's **spurious**;
  the output file is still written. Read it back, or write query output to `/tmp/...`.
- The sandbox shell occasionally loses `PATH` (`command not found: curl/tr/ls`).
  Prefix scripts with `export PATH=/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin:$PATH`
  or just do network/file work in Python.

---

## 2. Source schema (`cms3`)

- `kh_cms_page` — `(id, content longtext (JSON), version)`. The JSON is the page.
- `kh_cms_page_custom_index` — `(id, type, parent, status, title_hr, title_en, position, ...)`.
  `id` == the `kh_cms_page.id`. Use this to **find products and their child tabs**.
- `kh_cms_repository_file` — `(id, content JSON)`; JSON has `name`, `url`
  (`/.protect/image/<dir>/<name>_<hash>.<ext>`), `mime_type`, `hash`.
- `kh_cms_relation` — **IGNORE.** It's partial/legacy (only `ref_to` ≤ 71) and contains
  wrong file→page links. It is **not** the source of product images.

### Product page JSON (`kh_cms_page.content` → `.properties`)
- `title.value.{hr,en}` — page title.
- `alt_title.value.hr` → **altTitle**.
- `content.value.hr` — HTML; this is the **"Opis proizvoda"** description (NOT a tab).
- `primary_photo.image_id` → repository_file id of the **main photo** (note: it's
  `image_id`, the `.value` is null — that tripped me up).
- `product_gallery.value.items[]` — the real gallery. Each item has `file_id` and an
  embedded `file` object (with `url`). ~24 products have a non-empty gallery; most don't.
- `price.value` — usually `"0"` → leave `priceEur` empty.
- `price_cfg.value` — the **price configurator** (41 products). See mapping below.
- `paths` — `{hr: "/top-cat/cat/slug", en: "..."}` (sometimes a list, sometimes `[]`).
  Use `paths.hr` to match to the new page.

### Tabs = child `product-tab` pages
- Find with: `type='product-tab' AND parent=<productId>`, order by `position`.
- Each tab page's `properties.title.value.hr` is the tab title; `properties.is_used.value`
  (skip if `false`).
- **Tab content lives in `kh_cms_page.segments.hr`** (NOT a `content` property — the
  product-tab page has no `content` field). `segments.hr` is `[section]`; each section
  has `containers[][]` of items:
  - `type: "rte"` → `value.hr` is HTML.
  - `type: "image_box"` → `image_id` / `image_url` (a content image), plus optional
    `caption`, `link_type`/`link_url` (e.g. a `.pdf` "Preuzmite katalog" button).
- **Empty tabs:** "Naši radovi" / "Galerija radova" are empty in the dump (the old
  frontend populated them elsewhere). Drop tabs that have no content.

---

## 3. Mapping cms3 → new `product-item` block

The new block envelope is `{ "type": "product-item", "data": {...} }`, stored as a
one-element array in `page_translations.blocks` (locale `hr`). Target `data` shape lives
in `admin/src/blocks/ProductItemBlock.tsx` (`ProductItemData`).

| Target field | Source |
|---|---|
| `altTitle` | `alt_title.value.hr` |
| `description` (plain text) | `content.value.hr` → strip HTML to text (block tags → `\n\n`, `<br>` → `\n`) |
| `mainPhoto` | `primary_photo.image_id` → repo file `url` → hash → media |
| `galleryImages` | `product_gallery.value.items[].file_id` (or item.file.url) → hash → media |
| `priceEur` | `price.value` (skip `"0"`/`""`; format `%.2f`) |
| `additionalInfo.tabs` | child `product-tab` pages → `{id: slug(title), title, content: <Tiptap>}`, **dropping empty ones** |
| `konfiguratorCijene` | `price_cfg` (below) |

### Configurator (`price_cfg` → `konfiguratorCijene`)
```
construction        -> konstrukcija: [{id: str(c.id), naziv: c.title.hr, cijena: "%.2f"}]
graphic (if graphic_use) -> grafika: [{id, naziv: g.title.hr,
                                       cijene: {str(constructionId): "%.2f"}}]   # keys are construction ids!
base (if base_use)  -> baza: [{id, naziv: b.title.hr, cijena: "%.2f"}]
enabled       = any of the three has items
group1Label   = construction_title.hr  ONLY IF konstrukcija non-empty, else ""
group2Label   = graphic_title.hr       ONLY IF grafika non-empty, else ""
group3Label   = base_title.hr          ONLY IF baza non-empty, else ""
```
The crucial detail: `graphic[].price` is keyed by the **construction row id**, and the
new `grafika.cijene` is keyed by `konstrukcija.id` — so keep the construction ids as
`str(old id)` and the keys line up automatically. Leave unused-group labels empty
(the editor only requires a label when the group has items).

### RTE → Tiptap (`content` of each tab)
Walk the tab's `segments.hr` in order and build one `{type:"doc", content:[...]}`:
- `rte` items → parse HTML to StarterKit nodes (paragraph / heading / bulletList /
  orderedList / listItem / hardBreak / horizontalRule; marks bold/italic/underline/strike/link).
- **Downgrade `<hN style="font-weight:normal">` to `<p>`** — the old site used headings
  as a text-sizing hack; rendering them as real headings looks wrong. Keep true headings
  (`<h2>` section titles without normal-weight).
- `image_box` items → a Tiptap `image` node `{type:"image", attrs:{src: cdnUrl, alt}}`.
- `image_box` with `link_type=="file"` + `.pdf` `link_url` → a paragraph with a **link**
  (text = caption or "Preuzmite katalog", href = the PDF's media URL), not the button image.

---

## 4. Image resolution (cms3 file → this project's media)

All ~680 repository files were already uploaded to this project's media library, and the
upload **preserved the cms3 URL hash**. So match by that hash:

- cms3 file url: `/.protect/image/<dir>/<name>_<HASH>.<ext>` where `HASH` = `[0-9a-f]{16,}`.
- new `media_files.original_name`: `<name>_<HASH>.webp` (converted to webp, same HASH).
- Regex to pull the hash from either: `_([0-9a-f]{16,})\.[a-z0-9]+$`.
- Build `media[hash] = {mediaId, cdnUrl}` from
  `SELECT id, original_name, cdn_url FROM media_files;` and look up.

Coverage was 588/589 (the one miss was junk). If a hash isn't in media, **skip and report**.

---

## 5. Matching new pages → cms3 products

Build each new page's full path and match to `paths.hr`:
```sql
-- new page path = /<top-category slug>/<category slug>/<item slug>
SELECT '/'||gp.slug||'/'||cat.slug||'/'||i.slug AS path, ...
FROM (product-item pages) i
JOIN (parent category) cat ... JOIN (grandparent top-cat) gp ...
```
- Primary key: **full path** (case-insensitive). Disambiguates duplicate titles
  (Ostalo×2, Plakati×2, Beach Flag×2).
- Fallback: normalized title (diacritics stripped) — needed for the couple of cms3
  products whose `paths.hr` is empty.
- **"Beach Flag *1"** was a typo for "Beach Flag" — its live/cms3 path is
  `/prezentacijski-sustavi/tekstilni-sustavi/beach-flag` (special-case the override).
  Two Beach Flag pages legitimately exist; slugs are unique per locale, so one keeps a
  `-1` slug.
- 9 cms3 products are not in the new tree (Platna, Roll-Up Budget, Centro/Luban/Expo
  sustav, etc.) — ignore.

---

## 6. Writing to the DB (idempotent, reversible)

1. **Back up first:**
   ```sql
   SELECT json_agg(json_build_object('page_id',pt.page_id,'blocks',pt.blocks))
   FROM page_translations pt JOIN pages p ON p.id=pt.page_id
   WHERE p.type='product-item' AND p.deleted_at IS NULL;   -- save to a file
   ```
2. **Write** one `UPDATE` per page, dollar-quoting the JSON to avoid escaping hell:
   ```sql
   UPDATE page_translations
   SET blocks = $blk$[{"type":"product-item","data":{...}}]$blk$::jsonb, updated_at=now()
   WHERE page_id='<uuid>' AND locale='hr';
   ```
   Wrap all of them in `BEGIN; ... COMMIT;` and run with `psql -v ON_ERROR_STOP=1`.
   Only touch `blocks` (and `title` for the Beach Flag rename) — leave title/slug/parent.
3. **Verify** counts read back from the DB (descriptions, main photos, galleries,
   configurators, tab counts; assert no empty tabs, no stray group labels).

---

## 7. Frontend rendering (these were real bugs — keep them in mind)

In **`src/lib/tiptapRenderer.ts`** the JSON→HTML walker must handle:
- **`image` nodes** — originally missing, so tab images silently rendered nothing.
- **`.pdf` links** — rendered as a styled download button with an icon.

In **`src/routes/PageView.tsx`** the product main image uses `AspectRatio ratio={1}` (1:1).

In **`admin/src/blocks/ProductItemBlock.tsx`** a configurator group's title is required
**only when that group has ≥1 item** (empty groups aren't shown on the frontend).

---

## 8. Order of operations (next time)

1. Load `lineahr_cms3.sql` into a `mysql:8` container.
2. Export per product: `title, paths.hr, alt_title, price, content_hr, price_cfg,
   primary_photo.image_id, product_gallery.items, child tabs (title + segments)`.
3. Build `media[hash]` from this project's `media_files`.
4. Match new product-item pages → cms3 by path (title fallback).
5. Assemble each block (sections 3–4), dropping empty tabs.
6. Back up current blocks, then `UPDATE page_translations.blocks` in one transaction.
7. Verify from the DB; report skips (missing image hashes, unmatched pages, empty tabs).
8. Tear down the temp mysql container.

Reusable working scripts lived in `/tmp/linea_mig/` during the original run (ephemeral) —
the logic above is enough to regenerate them.
