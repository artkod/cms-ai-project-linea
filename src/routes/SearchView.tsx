import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Loader } from "@mantine/core";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllPages, type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";
import { eur } from "@/lib/pricing";
import { computeCardPrice } from "./AllProductsView";
import "@/styles/pages/catalog.scss";

// The search page renders product-item results that match the `?q=` query
// submitted from the navbar search form. The query is read straight from the
// URL. The layout reuses the catalog's `.cat-*` design (cards, sort bar, pager,
// empty state) — same as AllProductsView's results column, minus the filter
// sidebar — so search looks identical to the rest of the catalog.

interface ProductBlockData {
  altTitle?: string;
  mainPhoto?: { mediaId: string; cdnUrl: string } | null;
  description?: string;
  priceEur?: string;
  konfiguratorCijene?: {
    enabled?: boolean;
    konstrukcija?: { id: string; naziv: string; cijena: string }[];
    grafika?: { id: string; naziv: string; cijene: Record<string, string> }[];
    baza?: { id: string; naziv: string; cijena: string }[];
  };
}

interface ProductCardData {
  id: string;
  title: string;
  description: string;
  image: string | null;
  url: string;
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

export function SearchView({ page }: { page: Page }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

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

  // Each product-item joins to its category (parent) and products (grandparent)
  // so we can build a reachable hierarchical URL. Items whose ancestor chain
  // isn't fully published+active in this locale are skipped — same rule as the
  // all-products listing.
  const cards = useMemo<ProductCardData[]>(() => {
    const productsById = new Map(productsPages.map((p) => [p.id, p]));
    const categoriesById = new Map(categoryPages.map((p) => [p.id, p]));
    const out: ProductCardData[] = [];
    for (const item of itemPages) {
      const category = item.parentId ? categoriesById.get(item.parentId) : undefined;
      const products = category?.parentId ? productsById.get(category.parentId) : undefined;
      if (!category || !products) continue;
      const block = item.blocks?.find((b) => b.type === "product-item");
      const d = (block?.data ?? {}) as ProductBlockData;
      out.push({
        id: item.id,
        title: item.title,
        description: d.description?.trim() || "",
        image: d.mainPhoto?.cdnUrl ?? null,
        url: `/${locale}/${products.slug}/${category.slug}/${item.slug}`,
        categoryTitle: category.title,
        createdAt: item.createdAt,
        price: computeCardPrice(d),
      });
    }
    return out;
  }, [productsPages, categoryPages, itemPages, locale]);

  // Free-text match over title + description (case-insensitive).
  const matched = useMemo(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    return cards.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [cards, query]);

  const [sort, setSort] = useState<SortKey>("newest");
  const [pageSize, setPageSize] = useState(12);
  const [pageNum, setPageNum] = useState(1);

  // Reset to the first page whenever the query changes.
  useEffect(() => {
    setPageNum(1);
  }, [query]);

  const sorted = useMemo(() => {
    const arr = [...matched];
    const byPriceAsc = (a: ProductCardData, b: ProductCardData) => {
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
  }, [matched, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(pageNum, totalPages);
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const home = `/${locale}/`;

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

  const hasResults = query.length > 0 && sorted.length > 0;

  return (
    <div className="cat-view">
      {/* PAGE HEAD */}
      <section className="cat-pagehead">
        <div className="ln-container">
          <span className="cat-eyebrow">{tx("search.eyebrow", "Pretraga")}</span>
          <h1>{page.title}</h1>
          {!query && <p>{t("search.prompt")}</p>}
        </div>
      </section>

      <section className="ln-container">
        <div className="cat-searchbody">
          {hasResults ? (
            <>
              <div className="cat-resbar">
                <div className="cat-resbar__left">
                  <span className="cat-count">
                    {t("search.count_prefix")} <b>{sorted.length}</b> {t("search.count_suffix")} “{query}”
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
            </>
          ) : query ? (
            <div className="cat-empty">
              <Search aria-hidden="true" />
              <p>{t("search.empty_title")}</p>
              <span>{t("search.empty_text")} “{query}”.</span>
              <Link to={home} className="ln-btn ln-btn--ghost cat-empty__cta">{t("notfound.home")}</Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
