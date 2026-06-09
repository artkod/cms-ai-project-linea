import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader } from "@mantine/core";
import { ArrowRight, FolderOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { getAllPages, type Page } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import "@/styles/pages/eu.scss";

// ─── EU-project model (derived from child `eu-project-item` pages) ─────────────
//
// Each entry is a published `eu-project-item` page whose parent is this
// eu-projects page. Its card image is the project's `cardPhoto`; the short
// excerpt is the SEO meta description in this locale.

interface ProjectCard {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  excerpt: string;
}

function imgUrl(ref: unknown): string | null {
  if (ref && typeof ref === "object" && typeof (ref as { cdnUrl?: unknown }).cdnUrl === "string") {
    return (ref as { cdnUrl: string }).cdnUrl;
  }
  return null;
}

function toCard(p: Page, locale: string): ProjectCard {
  const td = p.typeData ?? {};
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    image: imgUrl(td.cardPhoto),
    excerpt: p.translations?.[locale]?.metaDescription ?? "",
  };
}

// Fixed UI labels (in code, not editable — per handoff §8).
const LABELS = {
  en: { read: "View project", empty: "No projects yet." },
  hr: { read: "Pogledaj projekt", empty: "Još nema projekata." },
} as const;

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

export function EuProjectsView({ page, locale }: { page: Page; locale: string }) {
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [items, setItems] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllPages("eu-project-item", locale)
      .then((pages) => {
        if (cancelled) return;
        setItems(pages.filter((p) => p.parentId === page.id).map((p) => toCard(p, locale)));
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page.id, locale]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(pageNo, totalPages);
  const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const itemHref = (slug: string) => `/${locale}/${page.slug}/${slug}`;

  return (
    <div className="eu-view">
      <section className="eu-head">
        <div className="ln-container">
          <span className="eu-eyebrow">{tx("euprojects.eyebrow", "Transparentnost i razvoj")}</span>
          <h1>{page.title}</h1>
          <p>{tx("euprojects.intro", "Ulažemo u znanje, tehnologiju i kapacitete uz potporu europskih fondova. U nastavku donosimo pregled projekata u kojima sudjelujemo.")}</p>
        </div>
      </section>

      <section className="eu-body">
        <div className="ln-container">
          {loading ? (
            <div className="ln-loading"><Loader color="var(--brand)" /></div>
          ) : items.length === 0 ? (
            <div className="eu-empty">
              <div className="eu-empty__ico"><FolderOpen aria-hidden="true" /></div>
              <p>{L.empty}</p>
            </div>
          ) : (
            <>
              <div className="eu-grid">
                {pageItems.map((it) => (
                  <Link key={it.id} to={itemHref(it.slug)} className="eu-card">
                    <div className="eu-card__media">
                      {it.image && <img className="ln-img" src={it.image} alt={it.title} loading="lazy" />}
                    </div>
                    <div className="eu-card__b">
                      <h3>{it.title}</h3>
                      {it.excerpt && <p className="eu-card__ex">{it.excerpt}</p>}
                      <span className="eu-card__link">
                        {L.read}
                        <ArrowRight aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="eu-pager">
                  <button type="button" className="eu-page is-nav" aria-label="Prethodna" disabled={currentPage <= 1} onClick={() => setPageNo(currentPage - 1)}>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  {pageList(currentPage, totalPages).map((p, i) =>
                    p === "gap" ? (
                      <span key={`gap-${i}`} className="eu-page__gap">…</span>
                    ) : (
                      <button type="button" key={p} className={`eu-page${p === currentPage ? " is-active" : ""}`} onClick={() => setPageNo(p)}>
                        {p}
                      </button>
                    ),
                  )}
                  <button type="button" className="eu-page is-nav" aria-label="Sljedeća" disabled={currentPage >= totalPages} onClick={() => setPageNo(currentPage + 1)}>
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
