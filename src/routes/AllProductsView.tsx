import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Loader } from "@mantine/core";
import { Search, Check, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { CategoryNode, ProductCard } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";
import { eurCents } from "@/lib/pricing";
import "@/styles/pages/catalog.scss";

// Catalogue listing — the `all-products` page, now backed by the commerce
// catalog API instead of product-item pages. The whole (small, <100 products)
// catalog is fetched once and filtered/sorted client-side, exactly like the
// legacy view, so the filter UX is unchanged: search, main-category checkboxes,
// subcategory chips, price range, sort, pagination.

// ─── Card model ─────────────────────────────────────────────────────────────

interface ProductCardData {
  id: string;
  title: string;
  description: string;
  image: string | null;
  url: string;
  categoryId: string; // subcategory id — drives the subcategory filter
  productsId: string; // main category id — drives the category filter
  categoryTitle: string; // subcategory label (shown on the card)
  /** Fetch-order index (server sort = newest) — drives newest/oldest sorting. */
  fetchIndex: number;
  price: { amount: number; from: boolean } | null; // amount in EUR cents
}

type SortKey = "newest" | "oldest" | "name" | "price_asc" | "price_desc";

const PAGE_SIZE_OPTIONS = [12, 24, 48];
const FETCH_LIMIT = 100; // the catalog API's max page size

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
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<ProductCard[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const loadAll = async (): Promise<ProductCard[]> => {
      const out: ProductCard[] = [];
      let offset = 0;
      for (;;) {
        const res = await storefront.listProducts({ locale, sort: "newest", limit: FETCH_LIMIT, offset });
        out.push(...res.data);
        offset += res.data.length;
        if (out.length >= res.total || res.data.length === 0) return out;
      }
    };
    Promise.all([storefront.listCategories({ locale }), loadAll()])
      .then(([cats, items]) => {
        if (!alive) return;
        setCategories(cats);
        setProducts(items);
      })
      .catch(() => {
        if (!alive) return;
        setCategories([]);
        setProducts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale]);

  const mains = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Build the card list. The migration made the SUBCATEGORY primary (main-only
  // products fall back to their main category), so the card's sub/main ids come
  // from the primary category node + its parent.
  const cards = useMemo<ProductCardData[]>(() => {
    return products.map((p, i) => {
      const primary = p.primaryCategoryId ? catById.get(p.primaryCategoryId) : null;
      const sub = primary?.parentId ? primary : null;
      const main = sub ? catById.get(sub.parentId!) ?? null : primary;
      return {
        id: p.id,
        title: p.name,
        description: p.shortDescription ?? "",
        image: p.image?.cdnUrl ?? null,
        url: `/${locale}/${page.slug}/${p.slug}`,
        categoryId: sub?.id ?? "",
        productsId: main?.id ?? "",
        categoryTitle: sub?.label ?? "",
        fetchIndex: i,
        // price = the cheapest variant's gross (cents); 0 → inquiry-only card.
        // Multiple price points → the "Već od …" starting-price form.
        price: p.price > 0 ? { amount: p.price, from: p.variantCount > 1 && p.priceMax > p.price } : null,
      };
    });
  }, [products, catById, locale, page.slug]);

  // Product count per main category (shown next to each category checkbox).
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) if (c.productsId) m.set(c.productsId, (m.get(c.productsId) ?? 0) + 1);
    return m;
  }, [cards]);

  // ─── Live filters ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [catIds, setCatIds] = useState<string[]>([]);
  const [subIds, setSubIds] = useState<string[]>([]);
  const [minStr, setMinStr] = useState<string>("");
  const [maxStr, setMaxStr] = useState<string>("");

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

  // Subcategory options narrow to the picked main categories (if any).
  const visibleSubs = useMemo(() => {
    const parents = catIds.length ? mains.filter((c) => catIds.includes(c.id)) : mains;
    const parentIds = new Set(parents.map((c) => c.id));
    return categories
      .filter((c) => c.parentId && parentIds.has(c.parentId))
      .map((c) => ({ id: c.id, title: c.label ?? "" }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [categories, mains, catIds]);

  useEffect(() => {
    const valid = new Set(visibleSubs.map((s) => s.id));
    setSubIds((prev) => prev.filter((id) => valid.has(id)));
  }, [visibleSubs]);

  // Any filter change snaps back to the first results page.
  useEffect(() => {
    setPageNum(1);
  }, [search, catIds, subIds, minStr, maxStr]);

  // Deep-link (`?kategorija=<category-slug>`) — from the homepage cards AND the
  // commerce category URLs (PageView redirects them here). Matches a MAIN
  // category (pre-checks it) or a SUBCATEGORY (pre-checks its parent + itself).
  const [searchParams] = useSearchParams();
  const catParam = searchParams.get("kategorija");
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (!catParam) { seededRef.current = true; return; }
    if (!categories.length) return; // wait for the taxonomy to load
    const match = categories.find((c) => c.slug === catParam);
    if (match && !match.parentId) {
      setCatIds([match.id]);
    } else if (match?.parentId) {
      setCatIds([match.parentId]);
      setSubIds([match.id]);
    }
    seededRef.current = true;
  }, [catParam, categories]);

  const categoryOptions = useMemo(
    () =>
      mains
        .map((c) => ({ id: c.id, title: c.label ?? "" }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [mains],
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
    // Price bounds are entered in EUR; card prices are cents.
    const min = toBound(minStr);
    const max = toBound(maxStr);
    return cards.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      if (catIds.length && !catIds.includes(c.productsId)) return false;
      if (subIds.length && !subIds.includes(c.categoryId)) return false;
      // A price bound excludes inquiry-only products (no comparable price).
      if (min != null || max != null) {
        if (!c.price) return false;
        if (min != null && c.price.amount < min * 100) return false;
        if (max != null && c.price.amount > max * 100) return false;
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
        arr.sort((a, b) => b.fetchIndex - a.fetchIndex);
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
        arr.sort((a, b) => a.fetchIndex - b.fetchIndex); // server sort = newest first
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
        {eurCents(price.amount)} <small>{t("product.price_vat_suffix")}</small>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="cat-view">
        <div className="ln-container ln-loading">
          <Loader color="var(--brand)" />
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
                      {c.image && <img className="ln-img" src={c.image + "?width=300"} alt={c.title} loading="lazy" />}
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
