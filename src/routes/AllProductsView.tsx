import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Loader } from "@mantine/core";
import { Search, Check, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllPages, type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";
import { eur } from "@/lib/pricing";
import "@/styles/pages/catalog.scss";

// ─── Pricing ──────────────────────────────────────────────────────────────────
// Mirrors the per-product pricing rules in PageView.tsx so cards agree with the
// product page: a fixed `priceEur`, or a `konfiguratorCijene` whose cheapest
// build is shown as a "Već od …" starting price, or nothing (inquiry-only).

interface KonstrukcijaRow { id: string; naziv: string; cijena: string }
interface GrafikaRow { id: string; naziv: string; cijene: Record<string, string> }
interface BazaRow { id: string; naziv: string; cijena: string }

interface ProductBlockData {
  altTitle?: string;
  mainPhoto?: { mediaId: string; cdnUrl: string } | null;
  description?: string;
  priceEur?: string;
  konfiguratorCijene?: {
    enabled?: boolean;
    konstrukcija?: KonstrukcijaRow[];
    grafika?: GrafikaRow[];
    baza?: BazaRow[];
  };
}

/** Parse "12,34" / "12.34" → number; empty / invalid / non-positive → 0. */
function parsePrice(v: unknown): number {
  if (typeof v !== "string") return 0;
  const s = v.replace(",", ".").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Cheapest full build: one option from each group that has rows. Grafika is
 *  matrix-priced (keyed by konstrukcija id) so it's minimised per-konstrukcija.
 *  Returns null when no positive build exists. */
function cheapestBuild(k: KonstrukcijaRow[], g: GrafikaRow[], b: BazaRow[]): number | null {
  const minBaza = b.length ? Math.min(...b.map((r) => parsePrice(r.cijena))) : 0;
  let best = Infinity;
  if (k.length) {
    for (const kr of k) {
      const kp = parsePrice(kr.cijena);
      const minGrafika = g.length ? Math.min(...g.map((gr) => parsePrice(gr.cijene?.[kr.id] ?? ""))) : 0;
      best = Math.min(best, kp + minGrafika + minBaza);
    }
  } else if (b.length) {
    best = minBaza;
  }
  if (!Number.isFinite(best) || best <= 0) return null;
  return best;
}

/** The price to show on a product card, or null for inquiry-only products.
 *  `from` marks a configurator's cheapest-build estimate ("Već od …"). */
export function computeCardPrice(d: ProductBlockData): { amount: number; from: boolean } | null {
  const fixed = parsePrice(d.priceEur);
  const konf = d.konfiguratorCijene;
  const k = konf?.konstrukcija ?? [];
  const g = konf?.grafika ?? [];
  const b = konf?.baza ?? [];
  const enabled = typeof konf?.enabled === "boolean" ? konf.enabled : k.length + g.length + b.length > 0;

  if (enabled) {
    const cheapest = cheapestBuild(k, g, b);
    return cheapest != null ? { amount: cheapest, from: true } : null;
  }
  if (fixed > 0) return { amount: fixed, from: false };
  return null;
}

// ─── Card model ─────────────────────────────────────────────────────────────

interface ProductCardData {
  id: string;
  title: string;
  description: string;
  image: string | null;
  url: string;
  categoryId: string; // product-category (parent) id  — drives subcategory filter
  productsId: string; // products (grandparent) id      — drives category filter
  categoryTitle: string;
  createdAt: string;
  price: { amount: number; from: boolean } | null;
}

type SortKey = "newest" | "oldest" | "name" | "price_asc" | "price_desc";

const PAGE_SIZE_OPTIONS = [12, 24, 48];

/** Page-number list with ellipsis gaps: always first/last + current ±1. */
function pageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = new Set<number>([1, total]);
  for (let i = current - 1; i <= current + 1; i++) if (i >= 1 && i <= total) wanted.add(i);
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function AllProductsView({ page }: { page: Page }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [loading, setLoading] = useState(true);
  const [productsPages, setProductsPages] = useState<Page[]>([]);
  const [categoryPages, setCategoryPages] = useState<Page[]>([]);
  const [itemPages, setItemPages] = useState<Page[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getAllPages("products", locale),
      getAllPages("product-category", locale),
      getAllPages("product-item", locale),
    ])
      .then(([products, categories, items]) => {
        if (!alive) return;
        setProductsPages(products);
        setCategoryPages(categories);
        setItemPages(items);
      })
      .catch(() => {
        if (!alive) return;
        setProductsPages([]);
        setCategoryPages([]);
        setItemPages([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  // Build the card list: each item joins to its category (parent) and products
  // (grandparent) so we can resolve a reachable URL and the filter facets.
  const cards = useMemo<ProductCardData[]>(() => {
    const productsById = new Map(productsPages.map((p) => [p.id, p]));
    const categoriesById = new Map(categoryPages.map((p) => [p.id, p]));
    const out: ProductCardData[] = [];
    for (const item of itemPages) {
      const category = item.parentId ? categoriesById.get(item.parentId) : undefined;
      const products = category?.parentId ? productsById.get(category.parentId) : undefined;
      // Skip items whose ancestor chain isn't fully published+active in this
      // locale — their hierarchical URL wouldn't resolve anyway.
      if (!category || !products) continue;
      const block = item.blocks?.find((b) => b.type === "product-item");
      const d = (block?.data ?? {}) as ProductBlockData;
      out.push({
        id: item.id,
        title: item.title,
        description: d.description?.trim() || "",
        image: d.mainPhoto?.cdnUrl ?? null,
        url: `/${locale}/${products.slug}/${category.slug}/${item.slug}`,
        categoryId: category.id,
        productsId: products.id,
        categoryTitle: category.title,
        createdAt: item.createdAt,
        price: computeCardPrice(d),
      });
    }
    return out;
  }, [productsPages, categoryPages, itemPages, locale]);

  // Product count per group (shown next to each category checkbox).
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) m.set(c.productsId, (m.get(c.productsId) ?? 0) + 1);
    return m;
  }, [cards]);

  // ─── Live filters ────────────────────────────────────────────────────────────
  // Every control writes straight into these and the grid re-filters as you
  // type / tick — there's no "Apply filters" step.
  const [search, setSearch] = useState("");
  const [catIds, setCatIds] = useState<string[]>([]);
  const [subIds, setSubIds] = useState<string[]>([]);
  const [minStr, setMinStr] = useState<string>("");
  const [maxStr, setMaxStr] = useState<string>("");

  // Display controls apply immediately (they're not part of the filter form).
  const [sort, setSort] = useState<SortKey>("newest");
  const [pageSize, setPageSize] = useState(12);
  const [pageNum, setPageNum] = useState(1);

  // Mobile filter drawer.
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    if (!filtersOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filtersOpen]);

  // Subcategory options narrow to the picked categories (if any). Drop selected
  // subcategory ids that fall outside the current category selection.
  const visibleSubs = useMemo(() => {
    const subs = catIds.length
      ? categoryPages.filter((c) => c.parentId && catIds.includes(c.parentId))
      : categoryPages;
    return [...subs].sort((a, b) => a.title.localeCompare(b.title));
  }, [categoryPages, catIds]);

  useEffect(() => {
    const valid = new Set(visibleSubs.map((s) => s.id));
    setSubIds((prev) => prev.filter((id) => valid.has(id)));
  }, [visibleSubs]);

  // Any filter change snaps back to the first results page.
  useEffect(() => {
    setPageNum(1);
  }, [search, catIds, subIds, minStr, maxStr]);

  // Deep-link from the homepage's "Naš asortiman" cards:
  // `?kategorija=<products-slug>` pre-checks that category once the data loads.
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get("kategorija");
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!catParam) { seededRef.current = true; return; }
    if (!productsPages.length) return; // wait for the groups to load
    const match = productsPages.find((p) => p.slug === catParam);
    if (match) setCatIds([match.id]);
    seededRef.current = true;
  }, [catParam, productsPages]);

  const categoryOptions = useMemo(
    () => [...productsPages].sort((a, b) => a.title.localeCompare(b.title)),
    [productsPages],
  );

  function toBound(v: string): number | null {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function toggleCat(id: string) {
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleSub(id: string) {
    setSubIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetFilters() {
    setSearch("");
    setCatIds([]);
    setSubIds([]);
    setMinStr("");
    setMaxStr("");
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = toBound(minStr);
    const max = toBound(maxStr);
    return cards.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      if (catIds.length && !catIds.includes(c.productsId)) return false;
      if (subIds.length && !subIds.includes(c.categoryId)) return false;
      // A price bound excludes inquiry-only products (no comparable price).
      if (min != null || max != null) {
        if (!c.price) return false;
        if (min != null && c.price.amount < min) return false;
        if (max != null && c.price.amount > max) return false;
      }
      return true;
    });
  }, [cards, search, catIds, subIds, minStr, maxStr]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const byPriceAsc = (a: ProductCardData, b: ProductCardData) => {
      // Inquiry-only products sort to the end regardless of direction.
      if (!a.price && !b.price) return 0;
      if (!a.price) return 1;
      if (!b.price) return -1;
      return a.price.amount - b.price.amount;
    };
    switch (sort) {
      case "name":
        arr.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "oldest":
        arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "price_asc":
        arr.sort(byPriceAsc);
        break;
      case "price_desc":
        arr.sort((a, b) => {
          if (!a.price && !b.price) return 0;
          if (!a.price) return 1;
          if (!b.price) return -1;
          return b.price.amount - a.price.amount;
        });
        break;
      case "newest":
      default:
        arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(pageNum, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "newest", label: t("allproducts.sort_newest") },
    { value: "oldest", label: t("allproducts.sort_oldest") },
    { value: "name", label: t("allproducts.sort_name") },
    { value: "price_asc", label: t("allproducts.sort_price_asc") },
    { value: "price_desc", label: t("allproducts.sort_price_desc") },
  ];

  function priceMarkup(price: ProductCardData["price"]) {
    if (!price) {
      return <div className="cat-card__price is-inquiry">{t("allproducts.price_inquiry")}</div>;
    }
    return (
      <div className="cat-card__price">
        {price.from && <span className="vec">{t("allproducts.price_from")} </span>}
        {eur(price.amount)} <small>{t("product.price_vat_suffix")}</small>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cat-view">
        <div className="ln-container" style={{ padding: "96px 0", textAlign: "center" }}>
          <Loader color="#9acb34" />
        </div>
      </div>
    );
  }

  return (
    <div className="cat-view">
      {/* PAGE HEAD */}
      <section className="cat-pagehead">
        <div className="ln-container">
          <span className="cat-eyebrow">{tx("allproducts.eyebrow", "Katalog")}</span>
          <h1>{page.title}</h1>
          <p>{tx("allproducts.intro", "Pregledajte cijeli asortiman — filtrirajte po kategoriji, cijeni ili nazivu i otvorite proizvod za upit.")}</p>
        </div>
      </section>

      <section className="ln-container">
        <div className="cat-layout">

          {/* SIDEBAR / DRAWER */}
          <aside className={`flt${filtersOpen ? " is-open" : ""}`} aria-label={tx("allproducts.filters", "Filteri")}>
            <div className="flt__mobilehead">
              <h2>{tx("allproducts.filters", "Filteri")}</h2>
              <button type="button" className="flt__close" aria-label={tx("allproducts.close_filters", "Zatvori filtere")} onClick={() => setFiltersOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="flt__sec">
              <h3 className="flt__h">{t("allproducts.search_label")}</h3>
              <div className="flt__search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  placeholder={t("allproducts.search_placeholder")}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                />
              </div>
            </div>

            {categoryOptions.length > 0 && (
              <div className="flt__sec">
                <h3 className="flt__h">{t("allproducts.categories_label")}</h3>
                {categoryOptions.map((c) => (
                  <label className="cat-check" key={c.id}>
                    <input type="checkbox" checked={catIds.includes(c.id)} onChange={() => toggleCat(c.id)} />
                    <span className="cat-check__box"><Check aria-hidden="true" /></span>
                    <span className="cat-check__txt">{c.title}</span>
                    <span className="cat-check__n">{groupCounts.get(c.id) ?? 0}</span>
                  </label>
                ))}
              </div>
            )}

            {visibleSubs.length > 0 && (
              <div className="flt__sec">
                <h3 className="flt__h">{t("allproducts.subcategories_label")}</h3>
                <div className="flt__chips">
                  {visibleSubs.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      className={`cat-chip${subIds.includes(s.id) ? " is-on" : ""}`}
                      onClick={() => toggleSub(s.id)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flt__sec">
              <h3 className="flt__h">{t("allproducts.price_label")}</h3>
              <div className="flt__price">
                <div className="flt__pricefield">
                  <label htmlFor="fltMin">{t("allproducts.price_min")}</label>
                  <input
                    id="fltMin"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="0"
                    value={minStr}
                    onChange={(e) => setMinStr(e.currentTarget.value)}
                  />
                </div>
                <span className="dash">–</span>
                <div className="flt__pricefield">
                  <label htmlFor="fltMax">{t("allproducts.price_max")}</label>
                  <input
                    id="fltMax"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="500"
                    value={maxStr}
                    onChange={(e) => setMaxStr(e.currentTarget.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flt__sec">
              <div className="flt__actions">
                {/* Filters apply live, so on mobile this just dismisses the drawer
                    to reveal the already-updated grid (hidden on desktop). */}
                <button type="button" className="ln-btn ln-btn--primary flt__show" onClick={() => setFiltersOpen(false)}>
                  {tx("allproducts.show_results", "Prikaži rezultate")} ({sorted.length})
                </button>
                <button type="button" className="ln-btn ln-btn--ghost" onClick={resetFilters}>
                  {t("allproducts.reset_filters")}
                </button>
              </div>
            </div>
          </aside>

          {/* RESULTS */}
          <div className="cat-results">
            <div className="cat-resbar">
              <div className="cat-resbar__left">
                <button type="button" className="ln-btn ln-btn--ghost openfilters" onClick={() => setFiltersOpen(true)}>
                  <SlidersHorizontal aria-hidden="true" />
                  {tx("allproducts.filters", "Filteri")}
                </button>
                <span className="cat-count">
                  {t("allproducts.count_prefix")} <b>{sorted.length}</b> {t("allproducts.count_suffix")}
                </span>
              </div>
              <div className="cat-sortwrap">
                <label htmlFor="resSort">{t("allproducts.sort_label")}</label>
                <select
                  id="resSort"
                  className="cat-select"
                  value={sort}
                  onChange={(e) => { setSort(e.currentTarget.value as SortKey); setPageNum(1); }}
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {paged.length === 0 ? (
              <div className="cat-empty">
                <Search aria-hidden="true" />
                <p>{t("allproducts.empty")}</p>
                <span>{tx("allproducts.empty_hint", "Pokušajte proširiti raspon cijene ili poništiti filtere.")}</span>
              </div>
            ) : (
              <div className="cat-grid">
                {paged.map((c) => (
                  <Link key={c.id} to={c.url} className="cat-card">
                    <div className="cat-card__media">
                      {c.image && <img className="ln-img" src={c.image} alt={c.title} loading="lazy" />}
                    </div>
                    <div className="cat-card__b">
                      {c.categoryTitle && <div className="cat-card__cat">{c.categoryTitle}</div>}
                      <div className="cat-card__name">{c.title}</div>
                      {c.description && <div className="cat-card__desc">{c.description}</div>}
                      {priceMarkup(c.price)}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {sorted.length > 0 && (
              <div className="cat-pager">
                <div className="cat-per">
                  <label htmlFor="resPer">{t("allproducts.per_page_label")}</label>
                  <select
                    id="resPer"
                    className="cat-select"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.currentTarget.value) || 12); setPageNum(1); }}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                {totalPages > 1 && (
                  <div className="cat-pagenums">
                    <button
                      type="button"
                      className="cat-page is-nav"
                      aria-label="Prethodna"
                      disabled={currentPage <= 1}
                      onClick={() => setPageNum(currentPage - 1)}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                    {pageList(currentPage, totalPages).map((p, i) =>
                      p === "gap" ? (
                        <span key={`gap-${i}`} className="cat-page__gap">…</span>
                      ) : (
                        <button
                          type="button"
                          key={p}
                          className={`cat-page${p === currentPage ? " is-active" : ""}`}
                          onClick={() => setPageNum(p)}
                        >
                          {p}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      className="cat-page is-nav"
                      aria-label="Sljedeća"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPageNum(currentPage + 1)}
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Mobile drawer overlay */}
      <div className={`flt-overlay${filtersOpen ? " is-open" : ""}`} onClick={() => setFiltersOpen(false)} />
    </div>
  );
}
