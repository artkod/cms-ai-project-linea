import { createContext, Fragment, useContext, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useSearchParams } from "react-router";
import { Loader, Box } from "@mantine/core";
import { Link } from "react-router";
import { useMediaQuery } from "@mantine/hooks";
import {
  Check, Truck, Share2, Link2, Mail, ArrowLeft, ChevronDown, ShoppingCart,
  X, ChevronLeft, ChevronRight, ZoomIn,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import {
  getPageBySlug,
  getAllPages,
  getSystemPageSlug,
  type Page,
  type Block,
  type LinkPagesMap,
  type AncestorEntry,
} from "@/lib/api";
import { tiptapToHtml } from "@/lib/tiptapRenderer";
import { usePageAlternates, useStrings, useLocaleConfig, usePageLayout } from "@/lib/locale";
import { parsePrice, eur } from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import { AllProductsView, computeCardPrice } from "./AllProductsView";
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

// ─── Product item view ────────────────────────────────────────────────────────

interface ProductItemTab {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
}

interface KonstrukcijaRow {
  id: string;
  naziv: string;
  cijena: string;
}

interface GrafikaRow {
  id: string;
  naziv: string;
  /** keyed by konstrukcija row id */
  cijene: Record<string, string>;
}

interface BazaRow {
  id: string;
  naziv: string;
  cijena: string;
}

interface ProductItemBlockData {
  altTitle?: string;
  mainPhoto?: GalleryImage | null;
  galleryImages?: GalleryImage[];
  description?: string;
  priceEur?: string;
  additionalInfo?: { tabs?: ProductItemTab[] };
  konfiguratorCijene?: {
    enabled?: boolean;
    group1Label?: string;
    group2Label?: string;
    group3Label?: string;
    konstrukcija?: KonstrukcijaRow[];
    grafika?: GrafikaRow[];
    baza?: BazaRow[];
  };
}

interface ConfiguratorState {
  total: number;
  hasAnySelection: boolean;
  controls: React.ReactNode;
  /** Stable signature of the current selection (for cart line de-duping). */
  selectionKey: string;
  /** Human-readable selected-options summary (for the cart line + inquiry). */
  selectionLabel: string;
}

interface GroupLabels {
  group1: string;
  group2: string;
  group3: string;
}

interface SelectOption {
  value: string;
  label: string;
}

// One native `<select class="pi-select">` field (Clean & Corporate spec). The
// locked variant greys the label + select and shows the helper hint underneath.
function ConfigField({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  helper,
}: {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div className={`pi-field${disabled ? " is-locked" : ""}`}>
      <label className="pi-field__lab">{label}</label>
      <select
        className="pi-select"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {disabled && helper && <p className="pi-field__help">{helper}</p>}
    </div>
  );
}

function useConfigurator(
  konstrukcija: KonstrukcijaRow[],
  grafika: GrafikaRow[],
  baza: BazaRow[],
  labels: GroupLabels,
  t: (key: string) => string
): ConfiguratorState {
  const [kId, setKId] = useState<string | null>(null);
  const [gId, setGId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  // Group 2 stays locked until something in group 1 is selected; clearing the
  // group-1 choice also drops the group-2 choice (its price keys off group 1).
  const handleK = (v: string | null) => {
    setKId(v);
    if (!v) setGId(null);
  };
  const group2Disabled = !kId;

  const selectedK = konstrukcija.find((r) => r.id === kId) ?? null;
  const selectedG = grafika.find((r) => r.id === gId) ?? null;
  const selectedB = baza.find((r) => r.id === bId) ?? null;

  const grafikaPrice = selectedG && selectedK ? parsePrice(selectedG.cijene[selectedK.id]) : 0;
  const konstrukcijaPrice = selectedK ? parsePrice(selectedK.cijena) : 0;
  const bazaPrice = selectedB ? parsePrice(selectedB.cijena) : 0;
  const total = konstrukcijaPrice + grafikaPrice + bazaPrice;

  const unnamed = t("product.option_unnamed");
  const placeholder = t("product.option_placeholder");

  const priced = (naziv: string, price: number) =>
    price > 0 ? `${naziv || unnamed} — ${eur(price)}` : naziv || unnamed;

  const kOptions = konstrukcija.map((r) => ({ value: r.id, label: priced(r.naziv, parsePrice(r.cijena)) }));
  const gOptions = grafika.map((r) => ({
    value: r.id,
    label: priced(r.naziv, selectedK ? parsePrice(r.cijene[selectedK.id]) : 0),
  }));
  const bOptions = baza.map((r) => ({ value: r.id, label: priced(r.naziv, parsePrice(r.cijena)) }));

  const g1Label = labels.group1 || t("product.option_konstrukcija");
  const g2Label = labels.group2 || t("product.option_grafika");
  const g3Label = labels.group3 || t("product.option_baza");

  const controls = (
    <>
      {konstrukcija.length > 0 && (
        <ConfigField
          label={g1Label}
          options={kOptions}
          value={kId}
          onChange={handleK}
          placeholder={placeholder}
        />
      )}
      {grafika.length > 0 && (
        <ConfigField
          label={g2Label}
          options={gOptions}
          value={gId}
          onChange={setGId}
          placeholder={placeholder}
          disabled={group2Disabled}
          helper={t("product.option_locked")}
        />
      )}
      {baza.length > 0 && (
        <ConfigField
          label={g3Label}
          options={bOptions}
          value={bId}
          onChange={setBId}
          placeholder={placeholder}
        />
      )}
    </>
  );

  const selectionParts: string[] = [];
  if (selectedK) selectionParts.push(`${g1Label}: ${selectedK.naziv || unnamed}`);
  if (selectedG) selectionParts.push(`${g2Label}: ${selectedG.naziv || unnamed}`);
  if (selectedB) selectionParts.push(`${g3Label}: ${selectedB.naziv || unnamed}`);

  return {
    total,
    hasAnySelection: Boolean(kId || gId || bId),
    controls,
    selectionKey: [kId, gId, bId].filter(Boolean).join("|"),
    selectionLabel: selectionParts.join(" · "),
  };
}

// ─── Related product card (siblings under the same category) ─────────────────

interface RelatedCard {
  id: string;
  title: string;
  categoryTitle: string;
  image: string | null;
  url: string;
  price: { amount: number; from: boolean } | null;
}

function ProductItemView({ page }: { page: Page }) {
  const { locale } = useRender();
  const { defaultLocale } = useLocaleConfig();
  const { t } = useStrings();
  // Editor-overridable label with a Croatian fallback, for keys that may not be
  // seeded yet (t() returns the key itself when unset — we don't want that on
  // chrome copy). Existing keys resolve normally.
  const tx = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const block = page.blocks?.find((bl) => bl.type === "product-item");
  const d = (block?.data ?? {}) as ProductItemBlockData;

  const altTitle = d.altTitle?.trim() || "";
  const mainPhoto = d.mainPhoto ?? null;
  const galleryImages = d.galleryImages ?? [];
  const description = d.description?.trim() || "";

  const fixedPrice = parsePrice(d.priceEur);
  const konf = d.konfiguratorCijene;
  const k = konf?.konstrukcija ?? [];
  const g = konf?.grafika ?? [];
  const b = konf?.baza ?? [];

  // Master toggle. Legacy rows (no `enabled` flag) fall back to "on iff they
  // carry configurator data" so fixed-price-only products keep their price.
  const konfEnabled = typeof konf?.enabled === "boolean"
    ? konf.enabled
    : k.length + g.length + b.length > 0;

  const hasKonfiguratorPrices = useMemo(() => {
    if (k.some((r) => parsePrice(r.cijena) > 0)) return true;
    if (g.some((r) => Object.values(r.cijene ?? {}).some((c) => parsePrice(c) > 0))) return true;
    if (b.some((r) => parsePrice(r.cijena) > 0)) return true;
    return false;
  }, [k, g, b]);

  // Gallery = main photo + extra gallery images, de-duplicated by mediaId.
  const allImages = useMemo(() => {
    const out: GalleryImage[] = [];
    const seen = new Set<string>();
    if (mainPhoto?.cdnUrl) { out.push(mainPhoto); seen.add(mainPhoto.mediaId); }
    for (const img of galleryImages) {
      if (img?.cdnUrl && !seen.has(img.mediaId)) { out.push(img); seen.add(img.mediaId); }
    }
    return out;
  }, [mainPhoto, galleryImages]);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = allImages[activeImageIndex] ?? null;

  const tabs = (d.additionalInfo?.tabs ?? []).filter((tb) => tb && tb.id);
  const [activeTabId, setActiveTabId] = useState<string | null>(tabs[0]?.id ?? null);
  // Desktop = horizontal tabs; ≤760px = single-open accordion (spec §3).
  // `getInitialValueInEffect:false` makes the first render reflect the real
  // viewport, avoiding a tabs→accordion flicker on hydration.
  const isMobileInfo = useMediaQuery("(max-width: 760px)", false, { getInitialValueInEffect: false });
  // Mobile accordion: single-open (opening one closes any other). All items
  // start collapsed on first render; `null` means none open.
  const [openInfoItem, setOpenInfoItem] = useState<string | null>(null);

  const configurator = useConfigurator(
    k,
    g,
    b,
    {
      group1: konf?.group1Label?.trim() ?? "",
      group2: konf?.group2Label?.trim() ?? "",
      group3: konf?.group3Label?.trim() ?? "",
    },
    t,
  );

  // Pricing mode:
  //  • configurator — toggle on AND at least one priced option exists
  //  • fixed        — toggle off AND a standalone price is set
  //  • inquiry      — everything else (incl. toggle off + empty price)
  let priceMode: "fixed" | "configurator" | "inquiry" = "inquiry";
  if (konfEnabled && hasKonfiguratorPrices) {
    priceMode = "configurator";
  } else if (!konfEnabled && fixedPrice > 0) {
    priceMode = "fixed";
  }

  // In configurator mode the customer must pick something before a price shows;
  // with nothing selected we treat the product exactly like an inquiry.
  const effectiveInquiry =
    priceMode === "inquiry" ||
    (priceMode === "configurator" && !configurator.hasAnySelection);

  const displayPrice =
    priceMode === "fixed"
      ? fixedPrice
      : priceMode === "configurator"
        ? configurator.total
        : 0;

  // ── Breadcrumb / category — from the by-slug `ancestors` (root → parent).
  // For a product-item that chain is [products-group, product-category]; the
  // immediate parent (last entry) is the category shown as the buy-card eyebrow.
  const ancestors = page.ancestors ?? [];
  const categoryAnc = ancestors.length ? ancestors[ancestors.length - 1] : null;
  const ancTitle = (a: AncestorEntry) =>
    a.locales[locale]?.title || a.locales[defaultLocale]?.title || a.type;
  const ancSlug = (a: AncestorEntry) =>
    a.locales[locale]?.slug || a.locales[defaultLocale]?.slug || "";
  const categoryTitle = categoryAnc ? ancTitle(categoryAnc) : "";
  const groupSlug = ancestors[0] ? ancSlug(ancestors[0]) : "";
  const categorySlug = categoryAnc ? ancSlug(categoryAnc) : "";

  // ── Related rail — other product-items under the same category (siblings,
  // auto-derived). Hidden when there are none. URLs reuse this page's group +
  // category slug chain. "Svi proizvodi" resolves the live all-products slug.
  const [related, setRelated] = useState<RelatedCard[]>([]);
  const [allProductsSlug, setAllProductsSlug] = useState("svi-proizvodi");
  useEffect(() => {
    let alive = true;
    if (!page.parentId || !groupSlug || !categorySlug) {
      setRelated([]);
      return;
    }
    Promise.all([
      getAllPages("product-item", locale),
      getSystemPageSlug("all-products", locale),
    ])
      .then(([items, allSlug]) => {
        if (!alive) return;
        setAllProductsSlug(allSlug);
        setRelated(
          items
            .filter((it) => it.parentId === page.parentId && it.id !== page.id)
            .map((it) => {
              const bd = (it.blocks?.find((bl) => bl.type === "product-item")?.data ?? {}) as ProductItemBlockData;
              return {
                id: it.id,
                title: it.title,
                categoryTitle,
                image: bd.mainPhoto?.cdnUrl ?? null,
                url: `/${locale}/${groupSlug}/${categorySlug}/${it.slug}`,
                price: computeCardPrice(bd),
              };
            }),
        );
      })
      .catch(() => {
        if (alive) setRelated([]);
      });
    return () => {
      alive = false;
    };
  }, [page.id, page.parentId, locale, groupSlug, categorySlug, categoryTitle]);

  const allProductsUrl = `/${locale}/${allProductsSlug}`;

  // ── Share row (optional chrome): native share / copy-link (+"Kopirano" tip)
  // / mailto.
  const [copied, setCopied] = useState(false);
  const pageUrl = () => (typeof window !== "undefined" ? window.location.href : "");
  const onShareNative = () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof navigator !== "undefined" && nav.share) {
      void nav.share({ title: page.title, url: pageUrl() }).catch(() => {});
    }
  };
  const onCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(pageUrl()).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }).catch(() => {});
    }
  };
  const onEmailShare = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(page.title)}&body=${encodeURIComponent(pageUrl())}`;
  };

  // ── Cart CTA ── Every product gets "Dodaj u košaricu" now, regardless of
  // price. No-price products (`priceMode === "inquiry"`) go in as an
  // on-request line (`unitPrice: null`). The one gate is a configurator with
  // nothing selected yet — the button is disabled until the customer picks an
  // option, so we never add an unconfigured build.
  const { addItem, items } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const addAsInquiry = priceMode === "inquiry";
  const needsSelection = priceMode === "configurator" && !configurator.hasAnySelection;

  // Cart-line key for the current build: a configurator build keys on id +
  // selection so distinct builds are distinct lines; everything else keys on id.
  const cartKey = configurator.selectionKey
    ? `${page.id}#${configurator.selectionKey}`
    : page.id;
  // Once this exact line is in the cart we lock the CTA — re-adding would only
  // bump the qty, which the cart page handles. The customer removes the line to
  // re-enable adding.
  const alreadyInCart = items.some((it) => it.key === cartKey);

  const productUrl =
    groupSlug && categorySlug
      ? `/${locale}/${groupSlug}/${categorySlug}/${page.slug}`
      : typeof window !== "undefined"
        ? window.location.pathname
        : `/${locale}/`;

  const addLabel = tx("product.add_to_cart", "Dodaj u košaricu");
  const addedLabel = tx("product.added_to_cart", "Dodano u košaricu");
  const inCartLabel = tx("product.in_cart", "U košarici");

  const handleAddToCart = () => {
    if (needsSelection || alreadyInCart) return;
    addItem({
      key: cartKey,
      productId: page.id,
      title: page.title,
      image: mainPhoto?.cdnUrl ?? activeImage?.cdnUrl ?? null,
      url: productUrl,
      unitPrice: addAsInquiry ? null : displayPrice,
      configLabel: configurator.selectionLabel || undefined,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
    notifications.show({ color: "teal", title: addedLabel, message: page.title });
  };

  const activeTab = tabs.find((tb) => tb.id === activeTabId) ?? tabs[0] ?? null;

  return (
    <div className="pi-page">
      {/* ── BREADCRUMB ── Home → ancestors (root → parent) → current page.
          Each ancestor links to its cumulative slug chain, but only when every
          segment up to it has an active translation in this locale (else the
          nested URL would 404 — render it as plain text instead). */}
      <nav className="pi-crumb" aria-label="Staza">
        <div className="ln-container pi-crumb__in">
          <Link to={`/${locale}/`}>{t("product.breadcrumb_home")}</Link>
          {ancestors.map((a, idx) => {
            const chain = ancestors.slice(0, idx + 1).map((x) => x.locales[locale]);
            const fullyActive = chain.every((c) => !!(c?.active && c.slug));
            const href = `/${locale}/${chain.map((c) => c!.slug).join("/")}`;
            return (
              <Fragment key={a.id}>
                <span className="sep">/</span>
                {fullyActive ? <Link to={href}>{ancTitle(a)}</Link> : <span>{ancTitle(a)}</span>}
              </Fragment>
            );
          })}
          <span className="sep">/</span>
          <span className="cur">{page.title}</span>
        </div>
      </nav>

      {/* ── HERO ── gallery + description (left) · buy/configure card (right) */}
      <section className="pi-hero">
        <div className="ln-container">
          <div className="pi-grid">

            {/* LEFT */}
            <div className="pi-main">
              <div className="pi-gallery">
                <div className="pi-gallery__main">
                  {activeImage && (
                    <img className="ln-img" src={activeImage.cdnUrl} alt={page.title} />
                  )}
                </div>
                {allImages.length > 1 && (
                  <div className="pi-thumbs">
                    {allImages.slice(0, 10).map((img, i) => (
                      <button
                        type="button"
                        key={img.mediaId}
                        className={`pi-thumb${i === activeImageIndex ? " is-active" : ""}`}
                        onClick={() => setActiveImageIndex(i)}
                        aria-label={`${t("product.aria_view_image")} ${i + 1}`}
                        aria-current={i === activeImageIndex}
                      >
                        <img className="ln-img" src={img.cdnUrl} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {description && (
                <section className="pi-about">
                  <h2>{t("product.about_heading")}</h2>
                  <p>{description}</p>
                </section>
              )}
            </div>

            {/* RIGHT — sticky buy / configure */}
            <aside className="pi-buy">
              {categoryTitle && <span className="pi-eyebrow pi-buy__cat">{categoryTitle}</span>}
              <h1>{page.title}</h1>
              {altTitle && <p className="pi-buy__sub">{altTitle}</p>}

              <div className="pi-badges">
                <span className="pi-badge">
                  <Check aria-hidden="true" />
                  {t("product.trust_available")}
                </span>
                <span className="pi-badge">
                  <Truck aria-hidden="true" />
                  {t("product.trust_fast_delivery")}
                </span>
              </div>

              <div className="pi-price">
                {!effectiveInquiry && (
                  <p className="pi-price__lbl">
                    {priceMode === "fixed"
                      ? tx("product.price_fixed_label", "Cijena")
                      : t("product.price_estimated_label")}
                  </p>
                )}
                <div className="pi-price__row">
                  {effectiveInquiry ? (
                    <span className="pi-price__big is-inquiry">{t("product.price_inquiry_label")}</span>
                  ) : (
                    <>
                      <span className="pi-price__big">{eur(displayPrice)}</span>
                      <span className="pi-price__vat">{t("product.price_vat_suffix")}</span>
                    </>
                  )}
                </div>

                {priceMode === "configurator" && (
                  <div className="pi-config">
                    <h3 className="pi-config__h">{t("product.configurator_heading")}</h3>
                    {configurator.controls}
                  </div>
                )}

                {/* CTA — every product adds to cart; a configurator with no
                    selection yet is disabled until the customer picks an option. */}
                <button
                  type="button"
                  className="ln-btn ln-btn--primary ln-btn--lg pi-cta"
                  onClick={handleAddToCart}
                  disabled={needsSelection || alreadyInCart}
                >
                  {justAdded || alreadyInCart ? (
                    <>
                      <Check size={18} aria-hidden="true" />
                      {alreadyInCart && !justAdded ? inCartLabel : addedLabel}
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={18} aria-hidden="true" />
                      {addLabel}
                    </>
                  )}
                </button>
                {needsSelection && (
                  <p className="pi-cta-hint">
                    {tx("product.select_option_hint", "Odaberite opciju za nastavak.")}
                  </p>
                )}

                <div className="pi-share">
                  <span className="pi-share__lbl">{t("product.share_label")}</span>
                  <button
                    type="button"
                    className="pi-share__btn"
                    aria-label={t("product.share_native")}
                    onClick={onShareNative}
                  >
                    <Share2 aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="pi-share__btn"
                    aria-label={t("product.share_copy_link")}
                    onClick={onCopyLink}
                  >
                    <Link2 aria-hidden="true" />
                    <span className={`pi-share__tip${copied ? " show" : ""}`}>
                      {tx("product.share_copied", "Kopirano")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pi-share__btn"
                    aria-label={t("product.share_email")}
                    onClick={onEmailShare}
                  >
                    <Mail aria-hidden="true" />
                  </button>
                </div>
              </div>
            </aside>

          </div>
        </div>
      </section>

      {/* ── INFO TABS ── desktop tabs / ≤760px accordion (single-open). Hidden
          when there are zero tabs; empty tab body → "Nema sadržaja." */}
      {tabs.length > 0 && (
        <section className="pi-tabs-sec">
          <div className="ln-container">
            <h2>{tx("product.details_heading", "Detalji proizvoda")}</h2>
            {isMobileInfo ? (
              <div className="pi-tabs">
                {tabs.map((tab) => {
                  const isOpen = openInfoItem === tab.id;
                  return (
                    <div className={`pi-acc${isOpen ? " is-open" : ""}`} key={tab.id}>
                      <button
                        type="button"
                        className="pi-acc__h"
                        aria-expanded={isOpen}
                        onClick={() => setOpenInfoItem(isOpen ? null : tab.id)}
                      >
                        {tab.title || t("product.option_unnamed")}
                        <ChevronDown aria-hidden="true" />
                      </button>
                      <div className="pi-acc__p">
                        {tab.content ? (
                          <div
                            className="pi-rich"
                            dangerouslySetInnerHTML={{ __html: tiptapToHtml(tab.content) }}
                          />
                        ) : (
                          <p className="pi-empty">{t("product.tab_empty")}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pi-tabs">
                <div className="pi-tabs__head" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeTabId}
                      className={`pi-tab${tab.id === activeTabId ? " is-active" : ""}`}
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      {tab.title || t("product.option_unnamed")}
                    </button>
                  ))}
                </div>
                <div className="pi-tabs__body">
                  {activeTab && activeTab.content ? (
                    <div
                      className="pi-rich"
                      dangerouslySetInnerHTML={{ __html: tiptapToHtml(activeTab.content) }}
                    />
                  ) : (
                    <p className="pi-empty">{t("product.tab_empty")}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── RELATED ── same-category siblings (auto-derived). Hidden when none. */}
      {related.length > 0 && (
        <section className="pi-rel">
          <div className="ln-container">
            <div className="pi-rel__head">
              <div>
                <span className="pi-eyebrow">{tx("product.related_eyebrow", "Iz iste kategorije")}</span>
                <h2>{tx("product.related_heading", "Srodni proizvodi")}</h2>
              </div>
              <Link to={allProductsUrl} className="ln-btn ln-btn--ghost">
                {tx("product.related_all_products", "Svi proizvodi")}
              </Link>
            </div>
            <div className="a-products">
              {related.map((p) => (
                <Link key={p.id} to={p.url} className="a-prod">
                  <div className="a-thumb">
                    {p.image && <img className="ln-img" src={p.image} alt={p.title} loading="lazy" />}
                  </div>
                  <div className="a-prod__b">
                    {p.categoryTitle && <div className="a-prod__cat">{p.categoryTitle}</div>}
                    <h3>{p.title}</h3>
                    {p.price ? (
                      <div className="a-prod__price">
                        {p.price.from ? `${t("allproducts.price_from")} ` : ""}
                        {eur(p.price.amount)} <small>{t("product.price_vat_suffix")}</small>
                      </div>
                    ) : (
                      <div className="a-prod__price a-prod__price--upit">{t("allproducts.price_inquiry")}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── MOBILE STICKY BAR ── (CSS shows it ≤760px) */}
      <div className="pi-bar">
        <div className="pi-bar__price">
          <span className="pi-bar__lbl">
            {effectiveInquiry ? t("product.mobile_price_label") : t("product.mobile_total_label")}
          </span>
          <span className={`pi-bar__val${effectiveInquiry ? " is-inquiry" : ""}`}>
            {effectiveInquiry ? t("product.mobile_on_inquiry") : eur(displayPrice)}
          </span>
        </div>
        <button type="button" className="ln-btn ln-btn--primary" onClick={handleAddToCart} disabled={needsSelection || alreadyInCart}>
          {alreadyInCart ? inCartLabel : justAdded ? addedLabel : addLabel}
        </button>
      </div>
      {/* Spacer so the footer clears the fixed mobile bar (≤760px). */}
      <div className="pi-bar-spacer" />
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
                {articleType && <span className="na-badge">{articleType}</span>}
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function PageView() {
  const params = useParams();
  const locale = params.locale;
  // Splat = the full hierarchical path after the locale (e.g. "proizvodi/busilice/x").
  const path = params["*"] ?? "";
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get("previewToken") ?? undefined;
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  // Any path that doesn't resolve to a published page renders the 404 view
  // (rather than redirecting home), so a bad/stale URL stays on the URL the
  // visitor typed and shows a proper "not found" page.
  const [notFound, setNotFound] = useState(false);
  const { setAlternates } = usePageAlternates();
  const { setFullBleed } = usePageLayout();

  // Some page types own full-bleed bands (e.g. the product page's flush
  // breadcrumb bar + tinted tabs band, the cart's head/body sections), so they
  // drop RootLayout's centered container. Reset on unmount / type change.
  useEffect(() => {
    const FULL_BLEED = new Set([
      "product-item", "cart", "all-products", "catalogues", "about-us", "news", "article",
      "eu-projects", "eu-project-item", "search", "default",
    ]);
    setFullBleed(FULL_BLEED.has(page?.type ?? ""));
    return () => setFullBleed(false);
  }, [page?.type, setFullBleed]);

  useEffect(() => {
    if (!path || !locale) return;
    setLoading(true);
    setNotFound(false);
    getPageBySlug(locale, path, previewToken)
      .then((data) => {
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
      {page.type === "product-item" ? (
        <ProductItemView page={page} />
      ) : page.type === "all-products" ? (
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
