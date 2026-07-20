import { createContext, Fragment, useContext, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { Loader, Box } from "@mantine/core";
import { Link } from "react-router";
import { ArrowLeft, X, ChevronDown, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import type { CatalogProduct } from "@cms/storefront";
import {
  getPageBySlug,
  getSystemPageSlug,
  type Page,
  type Block,
  type LinkPagesMap,
} from "@/lib/api";
import { tiptapToHtml } from "@/lib/tiptapRenderer";
import { usePageAlternates, useStrings, useLocaleConfig, usePageLayout } from "@/lib/locale";
import { useDocumentSeo } from "@/lib/seo";
import { AllProductsView } from "./AllProductsView";
import { CommerceProductView } from "./CommerceProductView";
import "@/styles/pages/product.scss";
import "@/styles/pages/mixed.scss";
import "@/styles/pages/detail.scss";
import { AboutUsView } from "./AboutUsView";
import { CataloguesView } from "./CataloguesView";
import { NewsView } from "./NewsView";
import { EuProjectsView } from "./EuProjectsView";
import { SearchView } from "./SearchView";
import { CartView } from "./CartView";
import { NotFound } from "./NotFound";

// ─── Render context (locale + linkPages, for nested renderers) ────────────────

interface RenderCtx {
  locale: string;
  linkPages: LinkPagesMap;
}

const RenderContext = createContext<RenderCtx>({ locale: "hr", linkPages: {} });

function useRender(): RenderCtx {
  return useContext(RenderContext);
}

// ─── Mixed content data shapes ────────────────────────────────────────────────

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) {
      return url;
    }
    return url;
  } catch {
    return null;
  }
}

interface MixedContentWidget {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface MixedContentColumn {
  id: string;
  width: number;
  widgets: MixedContentWidget[];
}

interface MixedContentData {
  layout: number[];
  columns: MixedContentColumn[];
}

interface GalleryImage {
  mediaId: string;
  cdnUrl: string;
  name?: string;
}

interface AccordionItem {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
}

// ─── Link widget (text link / semantic button) ──────────────────────────────

function LinkRenderer({ data }: { data: Record<string, unknown> }) {
  const { locale, linkPages } = useRender();
  const linkType = data.linkType as string;
  if (!linkType) return null;

  const displayText = (data.linkText as string) || undefined;
  const tooltip = (data.tooltip as string) || undefined;
  const asButton = Boolean(data.asButton);
  const openInNewTab = Boolean(data.openInNewTab);

  let href = "#";
  let isInternal = false;
  const rel = openInNewTab ? "noopener noreferrer" : undefined;
  const target = openInNewTab ? "_blank" : undefined;

  if (linkType === "page") {
    const pageId = (data.pageId as string) || "";
    const resolved = pageId ? linkPages[pageId]?.[locale] : null;
    const linkPath = resolved?.path && resolved.path.length ? resolved.path.join("/") : resolved?.slug;
    href = resolved?.active && linkPath ? `/${locale}/${linkPath}` : `/${locale}/`;
    isInternal = true;
  } else if (linkType === "remote") {
    href = (data.url as string) || "#";
  } else if (linkType === "email") {
    const e = (data.email as string) || "";
    const s = (data.emailSubject as string) || "";
    href = `mailto:${e}${s ? `?subject=${encodeURIComponent(s)}` : ""}`;
  } else if (linkType === "file") {
    href = (data.fileUrl as string) || "#";
  }

  const label = displayText || href;

  if (asButton) {
    // Semantic model: type (primary/secondary/tertiary) × size (sm/md/lg) ×
    // position (left/center/right). Legacy values clamp to a sensible default.
    const sz = data.buttonSize as string;
    const size = sz === "sm" || sz === "lg" ? sz : "md";
    const bt = data.buttonType as string;
    const type = bt === "secondary" || bt === "tertiary" ? bt : "primary";
    const ps = data.buttonPosition as string;
    const pos = ps === "center" || ps === "right" ? ps : "left";
    const cls = `mxbtn mxbtn--${type} mxbtn--${size}`;
    return (
      <div className={`mx-btnwrap pos-${pos}`}>
        {isInternal ? (
          <Link to={href} className={cls} title={tooltip}>{label}</Link>
        ) : (
          <a href={href} className={cls} target={target} rel={rel} title={tooltip}>{label}</a>
        )}
      </div>
    );
  }

  return (
    <div>
      {isInternal ? (
        <Link to={href} className="mx-textlink" title={tooltip}>{label}</Link>
      ) : (
        <a href={href} className="mx-textlink" target={target} rel={rel} title={tooltip}>{label}</a>
      )}
    </div>
  );
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

function TextWidget({ data }: { data: Record<string, unknown> }) {
  const html = data.json ? tiptapToHtml(data.json) : "";
  if (html) return <div className="mx-richtext" dangerouslySetInnerHTML={{ __html: html }} />;
  const content = (data.content as string) || "";
  return content ? <div className="mx-richtext"><p>{content}</p></div> : null;
}

function VideoWidget({ data }: { data: Record<string, unknown> }) {
  const embedUrl = getVideoEmbedUrl((data.url as string) || "");
  if (!embedUrl) return null;
  // 16:9 frame fills its box edge-to-edge; an author-set width caps how wide it grows.
  const maxW = data.width ? Number(data.width) : undefined;
  return (
    <div className="mx-video" style={maxW ? { maxWidth: maxW } : undefined}>
      <div className="mx-video__frame">
        <iframe
          src={embedUrl}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function AccordionWidget({ data }: { data: Record<string, unknown> }) {
  const items = (data.items as AccordionItem[]) ?? [];
  const title = (data.title as string) || "";
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (!items.length) return null;
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <div>
      {title && <div className="mx-acc__title">{title}</div>}
      <div className="mx-acc">
        {items.map((item) => {
          const isOpen = open.has(item.id);
          return (
            <div key={item.id} className={`mx-acc__item${isOpen ? " is-open" : ""}`}>
              <button type="button" className="mx-acc__h" aria-expanded={isOpen} onClick={() => toggle(item.id)}>
                {item.title}
                <ChevronDown className="mx-acc__chev" aria-hidden="true" />
              </button>
              <div className="mx-acc__p">
                <div className="mx-acc__pin">
                  <div className="mx-acc__body">
                    {item.content && (
                      <div className="mx-richtext" dangerouslySetInnerHTML={{ __html: tiptapToHtml(item.content) }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalleryWidget({ data }: { data: Record<string, unknown> }) {
  const imgs = (data.images as GalleryImage[]) ?? [];
  const [idx, setIdx] = useState<number | null>(null);

  useEffect(() => {
    if (idx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIdx(null);
      else if (e.key === "ArrowRight") setIdx((i) => (i === null ? i : (i + 1) % imgs.length));
      else if (e.key === "ArrowLeft") setIdx((i) => (i === null ? i : (i - 1 + imgs.length) % imgs.length));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [idx, imgs.length]);

  if (!imgs.length) return null;
  const cur = idx !== null ? imgs[idx] : null;

  return (
    <div>
      <div className="mx-gallery">
        {imgs.map((img, i) => (
          <button key={i} type="button" className="mx-gallery__item" onClick={() => setIdx(i)} aria-label={img.name || `Slika ${i + 1}`}>
            <img src={img.cdnUrl} alt={img.name || ""} loading="lazy" />
            <span className="mx-gallery__zoom"><ZoomIn aria-hidden="true" /></span>
          </button>
        ))}
      </div>
      {cur && idx !== null && (
        <div className="mx-lb" role="dialog" aria-modal="true">
          <div className="mx-lb__bg" onClick={() => setIdx(null)} />
          <button className="mx-lb__x" type="button" aria-label="Zatvori" onClick={() => setIdx(null)}>
            <X aria-hidden="true" />
          </button>
          {imgs.length > 1 && (
            <button className="mx-lb__nav mx-lb__prev" type="button" aria-label="Prethodna" onClick={() => setIdx((idx - 1 + imgs.length) % imgs.length)}>
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
          <div className="mx-lb__stage">
            <img className="mx-lb__img" src={cur.cdnUrl} alt={cur.name || ""} />
            {cur.name && <div className="mx-lb__cap">{cur.name}</div>}
          </div>
          {imgs.length > 1 && (
            <button className="mx-lb__nav mx-lb__next" type="button" aria-label="Sljedeća" onClick={() => setIdx((idx + 1) % imgs.length)}>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
          {imgs.length > 1 && <div className="mx-lb__count">{idx + 1} / {imgs.length}</div>}
        </div>
      )}
    </div>
  );
}

// Recursive — `section` embeds a nested 12-col row.
function SectionWidget({ data }: { data: Record<string, unknown> }) {
  const section = data as unknown as MixedContentData;
  if (!section.columns?.length) return null;
  return (
    <div className="mx-row mx-row--nested">
      {section.columns.map((col) => (
        <div key={col.id} className="mx-col" style={{ "--w": col.width } as CSSProperties}>
          {col.widgets.map((w) => renderWidget(w))}
        </div>
      ))}
    </div>
  );
}

function renderWidget(widget: MixedContentWidget) {
  switch (widget.type) {
    case "text": return <TextWidget key={widget.id} data={widget.data} />;
    case "video": return <VideoWidget key={widget.id} data={widget.data} />;
    case "link": return widget.data.linkType ? <LinkRenderer key={widget.id} data={widget.data} /> : null;
    case "accordion": return <AccordionWidget key={widget.id} data={widget.data} />;
    case "gallery": return <GalleryWidget key={widget.id} data={widget.data} />;
    case "section": return <SectionWidget key={widget.id} data={widget.data} />;
    default: return null;
  }
}

// ─── Block renderer ───────────────────────────────────────────────────────────
// Mixed Content is the only built-in block type. Renders one 12-column row;
// authored column widths map to `grid-column: span <w>` (stacks under 880px).
// Used by DefaultView (each block wrapped in a `.mx-section` band) and the
// article / eu-project detail views (inside their own container).

function BlockRenderer({ block }: { block: Block }) {
  if (block.type !== "mixed-content") return null;
  const d = block.data as unknown as MixedContentData;
  if (!d.columns?.length) return null;
  return (
    <div className="mx-row">
      {d.columns.map((col) => (
        <div key={col.id} className="mx-col" style={{ "--w": col.width } as CSSProperties}>
          {col.widgets.map((widget) => renderWidget(widget))}
        </div>
      ))}
    </div>
  );
}

// ─── Default view ─────────────────────────────────────────────────────────────

function DefaultView({ page }: { page: Page }) {
  // The route prints the page title above the blocks; each Mixed Content block
  // is its own full-width section band (border between), inner `.ln-container`.
  const blocks = (page.blocks ?? []).filter((b) => b.type === "mixed-content");
  return (
    <div className="mx-view">
      <section className="mx-pagehead">
        <div className="ln-container">
          <h1>{page.title}</h1>
        </div>
      </section>
      {blocks.map((block) => (
        <section className="mx-section" key={block.id}>
          <div className="ln-container">
            <BlockRenderer block={block} />
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Detail-page helpers (article + eu-project) ───────────────────────────────

// Croatian short date "28. svi. 2026" (matches the news listing / mock).
const HR_MONTHS_SHORT = ["sij", "velj", "ožu", "tra", "svi", "lip", "srp", "kol", "ruj", "lis", "stu", "pro"];
function formatDetailDate(iso: string, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (locale === "hr") return `${d.getDate()}. ${HR_MONTHS_SHORT[d.getMonth()]}. ${d.getFullYear()}`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Back-link to the immediate parent listing, built from the ancestor chain so
// it carries the full hierarchical path. Returns null when no ancestor resolves
// in the active locale (caller falls back to a plain label).
function parentListingLink(
  page: Page,
  locale: string,
): { href: string; title: string } | null {
  const anc = page.ancestors ?? [];
  if (!anc.length) return null;
  const segs = anc.map((a) => a.locales[locale]?.slug).filter((s): s is string => !!s);
  if (segs.length !== anc.length) return null; // an ancestor is inactive in this locale
  const parent = anc[anc.length - 1];
  return { href: `/${locale}/${segs.join("/")}`, title: parent.locales[locale]?.title ?? "" };
}

// ─── Article view ───────────────────────────────────────────────────────────
//
// News article detail: centered back-link + type badge + date + title, then
// the Mixed Content body inside a narrow reading column (all in-article imagery
// lives in the body widgets). The `cardPhoto` is only used by the news listing.

function ArticleView({ page, locale }: { page: Page; locale: string }) {
  const { t } = useStrings();
  const tx = (key: string, fb: string) => { const v = t(key); return v === key ? fb : v; };

  const td = page.typeData ?? {};
  const articleType = typeof td.articleType === "string" ? td.articleType : "";
  const date = formatDetailDate(page.updatedAt || page.createdAt, locale);
  const back = parentListingLink(page, locale);
  const backLabel = back?.title || tx("article.back", "Novosti");

  return (
    <div className="na-view">
      <section className="na-top">
        <div className="ln-container">
          {back && (
            <Link to={back.href} className="na-back">
              <ArrowLeft aria-hidden="true" /> {backLabel}
            </Link>
          )}
          <div className="na-head">
            {(articleType || date) && (
              <div className="na-meta">
                {articleType && <span className="na-badge">{tx("article.cat_" + articleType, articleType)}</span>}
                {date && <span className="na-date">{date}</span>}
              </div>
            )}
            <h1>{page.title}</h1>
          </div>
        </div>
      </section>

      <section className="na-body">
        <div className="ln-container">
          <article className="na-prose">
            {page.blocks?.map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
            <hr className="na-divider" />
            <div className="na-foot">
              {back && (
                <Link to={back.href} className="ln-btn ln-btn--ghost">
                  <ArrowLeft aria-hidden="true" /> {tx("article.all", "Sve novosti")}
                </Link>
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

// ─── EU project view ──────────────────────────────────────────────────────────
//
// EU-project detail: back-link + "EU Projekt" eyebrow + title, then the Mixed
// Content body inside a narrow reading column (all imagery lives in the body).

function EuProjectItemView({ page, locale }: { page: Page; locale: string }) {
  const { t } = useStrings();
  const tx = (key: string, fb: string) => { const v = t(key); return v === key ? fb : v; };

  const back = parentListingLink(page, locale);
  const backLabel = back?.title || tx("euproject.back", "EU Projekti");

  return (
    <div className="ep-view">
      <section className="ep-top">
        <div className="ln-container">
          {back && (
            <Link to={back.href} className="ep-back">
              <ArrowLeft aria-hidden="true" /> {backLabel}
            </Link>
          )}
          <div className="ep-title">
            <span className="ep-eyebrow">{tx("euproject.eyebrow", "EU Projekt")}</span>
            <h1>{page.title}</h1>
          </div>
        </div>
      </section>

      <section className="ep-body">
        <div className="ln-container">
          <article className="ep-prose">
            {page.blocks?.map((block) => (
              <BlockRenderer key={block.id} block={block} />
            ))}
            <hr className="ep-divider" />
            <div className="ep-foot">
              {back && (
                <Link to={back.href} className="ln-btn ln-btn--ghost">
                  <ArrowLeft aria-hidden="true" /> {tx("euproject.all", "Svi EU projekti")}
                </Link>
              )}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

// A commerce category URL (e.g. /hr/tisak-velikih-formata/tekstil) redirects to
// the catalogue listing pre-filtered to that category — the flat URL scheme
// keeps one listing page. The listing's slug is editor-defined, so resolve it
// before navigating.
function CategoryRedirect({ locale, categorySlug }: { locale: string; categorySlug: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getSystemPageSlug("all-products", locale)
      .then((s) => { if (alive) setSlug(s); })
      .catch(() => { if (alive) setSlug("svi-proizvodi"); });
    return () => { alive = false; };
  }, [locale]);
  if (!slug) return <Loader />;
  return <Navigate to={`/${locale}/${slug}?kategorija=${encodeURIComponent(categorySlug)}`} replace />;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PageView() {
  const params = useParams();
  const locale = params.locale;
  // Splat = the full hierarchical path after the locale (e.g. "proizvodi/busilice/x").
  const path = params["*"] ?? "";
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get("previewToken") ?? undefined;
  const [page, setPage] = useState<Page | null>(null);
  // Commerce fallthrough (by-slug resolves page tree → category → product):
  // a `kind:"product"` payload renders the commerce product page; a
  // `kind:"category"` payload redirects to the catalogue listing pre-filtered
  // to that category (the flat URL scheme keeps /svi-proizvodi the only listing).
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Any path that doesn't resolve to a published page renders the 404 view
  // (rather than redirecting home), so a bad/stale URL stays on the URL the
  // visitor typed and shows a proper "not found" page.
  const [notFound, setNotFound] = useState(false);
  const { setAlternates } = usePageAlternates();
  const { setFullBleed } = usePageLayout();
  const { settings } = useLocaleConfig();

  // Per-page SEO head tags with site-default fallbacks (D3). Preview renders
  // unpublished content, so force noindex regardless of the page's own flag.
  useDocumentSeo(
    page
      ? {
          title: page.title,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
          ogImageUrl: page.ogImageUrl,
          canonicalUrl: page.canonicalUrl,
          noindex: page.noindex || !!previewToken,
        }
      : null,
    settings,
  );

  // Some page types own full-bleed bands (e.g. the product page's flush
  // breadcrumb bar + tinted tabs band, the cart's head/body sections), so they
  // drop RootLayout's centered container. Reset on unmount / type change.
  useEffect(() => {
    const FULL_BLEED = new Set([
      "cart", "all-products", "catalogues", "about-us", "news", "article",
      "eu-projects", "eu-project-item", "search", "default",
    ]);
    setFullBleed(!!product || FULL_BLEED.has(page?.type ?? ""));
    return () => setFullBleed(false);
  }, [page?.type, product, setFullBleed]);

  useEffect(() => {
    if (!path || !locale) return;
    setLoading(true);
    setNotFound(false);
    setProduct(null);
    setCategorySlug(null);
    getPageBySlug(locale, path, previewToken)
      .then((data) => {
        const kind = (data as { kind?: string } | null)?.kind;
        if (kind === "product") {
          setPage(null);
          setProduct(data as unknown as CatalogProduct);
          return;
        }
        if (kind === "category") {
          setPage(null);
          setCategorySlug(path.split("/").filter(Boolean).pop() ?? null);
          return;
        }
        if (!data || (!previewToken && data.status !== "published")) {
          setPage(null);
          setNotFound(true);
        } else {
          setPage(data);
          setAlternates(data.alternates ?? null);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [locale, path, previewToken, setAlternates]);

  useEffect(() => {
    return () => setAlternates(null);
  }, [setAlternates]);

  if (loading) return <Loader />;
  if (notFound) return <NotFound />;
  if (product) return <CommerceProductView product={product} />;
  if (categorySlug) return <CategoryRedirect locale={locale ?? "hr"} categorySlug={categorySlug} />;
  if (!page) return null;

  const activeLocale = locale ?? page.locale ?? "hr";
  const linkPages = page.linkPages ?? {};

  const previewBanner = previewToken ? (
    <Box
      p="xs"
      style={{
        background: "#f5a623",
        color: "#000",
        textAlign: "center",
        fontWeight: 600,
        fontSize: 14,
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      Preview mode — this page is not published
    </Box>
  ) : null;

  return (
    <RenderContext.Provider value={{ locale: activeLocale, linkPages }}>
      {previewBanner}
      {page.type === "all-products" ? (
        <AllProductsView page={page} />
      ) : page.type === "about-us" ? (
        <AboutUsView page={page} locale={activeLocale} />
      ) : page.type === "catalogues" ? (
        <CataloguesView page={page} locale={activeLocale} />
      ) : page.type === "news" ? (
        <NewsView page={page} locale={activeLocale} />
      ) : page.type === "article" ? (
        <ArticleView page={page} locale={activeLocale} />
      ) : page.type === "eu-projects" ? (
        <EuProjectsView page={page} locale={activeLocale} />
      ) : page.type === "eu-project-item" ? (
        <EuProjectItemView page={page} locale={activeLocale} />
      ) : page.type === "search" ? (
        <SearchView page={page} />
      ) : page.type === "cart" ? (
        <CartView page={page} />
      ) : page.type === "404" ? (
        <NotFound />
      ) : (
        <DefaultView page={page} />
      )}
    </RenderContext.Provider>
  );
}
