import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader } from "@mantine/core";
import { Star, ArrowRight, Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllPages, type Page } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import "@/styles/pages/news.scss";

// ─── Article model (derived from child `article` pages of the news page) ───────
//
// Each article is a published `article` page whose parent is this news page.
// Content fields come from the article page's typeData:
//   articleType  → string (the Settings → Article dropdown value)
//   cardPhoto    → { cdnUrl } (listing thumbnail)
// The short excerpt is the SEO meta description of the article in this locale.

interface ArticleCard {
  id: string;
  title: string;
  slug: string;
  type: string;
  cardImage: string | null;
  excerpt: string;
  date: string;
}

function imgUrl(ref: unknown): string | null {
  if (ref && typeof ref === "object" && typeof (ref as { cdnUrl?: unknown }).cdnUrl === "string") {
    return (ref as { cdnUrl: string }).cdnUrl;
  }
  return null;
}

function toArticle(p: Page, locale: string): ArticleCard {
  const td = p.typeData ?? {};
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    type: typeof td.articleType === "string" ? td.articleType : "",
    cardImage: imgUrl(td.cardPhoto),
    excerpt: p.translations?.[locale]?.metaDescription ?? "",
    date: p.updatedAt ?? p.createdAt ?? "",
  };
}

// Fixed UI labels (in code, not editable — per handoff §9).
const LABELS = {
  en: { all: "All", sortLabel: "Sort", latest: "Latest", oldest: "Oldest", read: "Read article", empty: "No articles yet.", featured: "Featured" },
  hr: { all: "Sve", sortLabel: "Sortiraj", latest: "Najnovije", oldest: "Najstarije", read: "Pročitaj članak", empty: "Još nema članaka.", featured: "Izdvojeno" },
} as const;

// Croatian short date "5. lip. 2026" (month abbreviations per handoff).
const HR_MONTHS = ["sij", "velj", "ožu", "tra", "svi", "lip", "srp", "kol", "ruj", "lis", "stu", "pro"];
function formatDate(iso: string, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (locale === "hr") return `${d.getDate()}. ${HR_MONTHS[d.getMonth()]}. ${d.getFullYear()}`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Page-number list with ellipsis gaps. */
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

const PAGE_SIZE = 9;

export function NewsView({ page, locale }: { page: Page; locale: string }) {
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("__all__");
  const [sort, setSort] = useState<string>("latest");
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllPages("article", locale)
      .then((pages) => {
        if (cancelled) return;
        setArticles(pages.filter((p) => p.parentId === page.id).map((p) => toArticle(p, locale)));
      })
      .catch(() => { if (!cancelled) setArticles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page.id, locale]);

  // Localized display label for an article-category key (e.g. "investicije").
  // The stored value is a single cross-locale taxonomy key; the label comes
  // from editable strings, falling back to the raw key if untranslated.
  const catLabel = (ty: string) => tx("article.cat_" + ty, ty);

  // Distinct article types present in the content drive the filter chips.
  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) if (a.type) set.add(a.type);
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [articles]);

  const visible = useMemo(() => {
    const filtered = filter === "__all__" ? articles : articles.filter((a) => a.type === filter);
    return [...filtered].sort((a, b) =>
      sort === "latest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
  }, [articles, filter, sort]);

  useEffect(() => setPageNo(1), [filter, sort]);

  // Featured = newest, only in the default view (Najnovije + "Sve").
  const featured = sort === "latest" && filter === "__all__" ? visible[0] : undefined;
  const listSource = featured ? visible.slice(1) : visible;
  const totalPages = Math.max(1, Math.ceil(listSource.length / PAGE_SIZE));
  const currentPage = Math.min(pageNo, totalPages);
  const pageItems = listSource.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const articleHref = (slug: string) => `/${locale}/${page.slug}/${slug}`;

  return (
    <div className="nw-view">
      <section className="nw-head">
        <div className="ln-container">
          <span className="nw-eyebrow">{tx("news.eyebrow", "Iz Linee")}</span>
          <h1>{page.title}</h1>
          <p>{tx("news.intro", "Investicije, nove tehnologije i proizvodi — pratite što se događa u našem studiju i proizvodnom pogonu.")}</p>
        </div>
      </section>

      <section className="nw-body">
        <div className="ln-container">
          {loading ? (
            <div style={{ padding: "80px 0", textAlign: "center" }}><Loader color="#9acb34" /></div>
          ) : articles.length === 0 ? (
            <div className="nw-empty">
              <div className="nw-empty__ico"><Newspaper aria-hidden="true" /></div>
              <p>{L.empty}</p>
            </div>
          ) : (
            <>
              {/* Featured (newest, default view only) */}
              {featured && (
                <Link to={articleHref(featured.slug)} className="nw-feat">
                  <div className="nw-feat__media">
                    {featured.cardImage && <img className="ln-img" src={featured.cardImage} alt={featured.title} />}
                    <span className="nw-feat__izd"><Star aria-hidden="true" />{L.featured}</span>
                  </div>
                  <div className="nw-feat__b">
                    <div className="nw-feat__meta">
                      {featured.type && <span className="nw-badge">{catLabel(featured.type)}</span>}
                      {formatDate(featured.date, locale) && <span className="nw-feat__date">{formatDate(featured.date, locale)}</span>}
                    </div>
                    <h2 className="nw-feat__title">{featured.title}</h2>
                    {featured.excerpt && <p className="nw-feat__ex">{featured.excerpt}</p>}
                    <span className="nw-feat__cta ln-btn ln-btn--primary ln-btn--lg">
                      {L.read}
                      <ArrowRight className="ln-arrow" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              )}

              {/* Filter + sort bar */}
              <div className="nw-bar">
                <div className="nw-chips">
                  <button
                    type="button"
                    className={`nw-chip${filter === "__all__" ? " is-on" : ""}`}
                    onClick={() => setFilter("__all__")}
                  >
                    {L.all}
                  </button>
                  {types.map((ty) => (
                    <button
                      key={ty}
                      type="button"
                      className={`nw-chip${filter === ty ? " is-on" : ""}`}
                      onClick={() => setFilter(ty)}
                    >
                      {catLabel(ty)}
                    </button>
                  ))}
                </div>
                <div className="nw-sortwrap">
                  <label htmlFor="nwSort">{L.sortLabel}</label>
                  <select id="nwSort" className="nw-select" value={sort} onChange={(e) => setSort(e.currentTarget.value)}>
                    <option value="latest">{L.latest}</option>
                    <option value="oldest">{L.oldest}</option>
                  </select>
                </div>
              </div>

              {/* Grid */}
              {pageItems.length === 0 ? (
                <div className="nw-empty">
                  <div className="nw-empty__ico"><Newspaper aria-hidden="true" /></div>
                  <p>{L.empty}</p>
                </div>
              ) : (
                <div className="nw-grid">
                  {pageItems.map((a) => (
                    <Link key={a.id} to={articleHref(a.slug)} className="nw-card">
                      <div className="nw-card__media">
                        {a.cardImage && <img className="ln-img" src={a.cardImage} alt={a.title} loading="lazy" />}
                        {a.type && <span className="nw-badge nw-badge--onmedia">{catLabel(a.type)}</span>}
                      </div>
                      <div className="nw-card__b">
                        {formatDate(a.date, locale) && <div className="nw-card__date">{formatDate(a.date, locale)}</div>}
                        <div className="nw-card__title">{a.title}</div>
                        {a.excerpt && <div className="nw-card__ex">{a.excerpt}</div>}
                        <span className="nw-card__link">
                          {L.read}
                          <ArrowRight aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="nw-pager">
                  <button type="button" className="nw-page is-nav" aria-label="Prethodna" disabled={currentPage <= 1} onClick={() => setPageNo(currentPage - 1)}>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  {pageList(currentPage, totalPages).map((p, i) =>
                    p === "gap" ? (
                      <span key={`gap-${i}`} className="nw-page__gap">…</span>
                    ) : (
                      <button type="button" key={p} className={`nw-page${p === currentPage ? " is-active" : ""}`} onClick={() => setPageNo(p)}>
                        {p}
                      </button>
                    ),
                  )}
                  <button type="button" className="nw-page is-nav" aria-label="Sljedeća" disabled={currentPage >= totalPages} onClick={() => setPageNo(currentPage + 1)}>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
