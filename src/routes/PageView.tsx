import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import {
  Title,
  Text,
  Loader,
  Box,
  Button,
  Anchor,
  Badge,
  SimpleGrid,
  Image,
  Accordion,
  Group,
  Select,
  Stack,
  Tabs,
  Card,
  Divider,
  Grid,
  Breadcrumbs,
  AspectRatio,
  UnstyledButton,
} from "@mantine/core";
import { Link } from "react-router";
import { useMediaQuery } from "@mantine/hooks";
import { getPageBySlug, type Page, type Block, type LinkPagesMap } from "@/lib/api";
import { tiptapToHtml } from "@/lib/tiptapRenderer";
import { usePageAlternates, useStrings, useLocaleConfig } from "@/lib/locale";
import { AllProductsView } from "./AllProductsView";
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
}

interface AccordionItem {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
}

// ─── Link renderer ────────────────────────────────────────────────────────────

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
    // Resolve pageId → /{locale}/{hierarchical path} via the page-payload
    // `linkPages` map. Fall back to the bare slug, then to /{locale}/ when the
    // target page has no active translation here.
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
  const justifyMap: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

  if (asButton) {
    const size = (data.buttonSize as string) || "md";
    const color = (data.buttonColor as string) || "teal";
    const variant = (data.buttonVariant as string) || "filled";
    const position = (data.buttonPosition as string) || "left";

    const inner = isInternal ? (
      <Link to={href} style={{ textDecoration: "none" }} title={tooltip}>
        <Button size={size as "xs" | "sm" | "md" | "lg" | "xl"} color={color} variant={variant as "filled" | "outline" | "light" | "subtle"}>
          {label}
        </Button>
      </Link>
    ) : (
      <a href={href} target={target} rel={rel} style={{ textDecoration: "none" }} title={tooltip}>
        <Button size={size as "xs" | "sm" | "md" | "lg" | "xl"} color={color} variant={variant as "filled" | "outline" | "light" | "subtle"}>
          {label}
        </Button>
      </a>
    );
    return (
      <Box mb="sm" style={{ display: "flex", justifyContent: justifyMap[position] || "flex-start" }}>
        {inner}
      </Box>
    );
  }

  if (isInternal) {
    return (
      <Box mb="sm">
        <Link to={href} style={{ color: "var(--mantine-color-teal-filled)" }} title={tooltip}>
          {label}
        </Link>
      </Box>
    );
  }
  return (
    <Box mb="sm">
      <Anchor href={href} target={target} rel={rel} title={tooltip}>{label}</Anchor>
    </Box>
  );
}

// ─── Widget renderer (recursive — handles section nesting) ───────────────────

function renderWidget(widget: MixedContentWidget) {
  if (widget.type === "text") {
    if (widget.data.json) {
      const html = tiptapToHtml(widget.data.json);
      return html ? (
        <Box key={widget.id} mb="sm" dangerouslySetInnerHTML={{ __html: html }} />
      ) : null;
    }
    return (
      <Text key={widget.id} mb="sm">
        {(widget.data.content as string) || ""}
      </Text>
    );
  }
  if (widget.type === "video") {
    const embedUrl = getVideoEmbedUrl((widget.data.url as string) || "");
    if (!embedUrl) return null;
    // Always keep a 16:9 frame so the embed fills its box edge-to-edge (no
    // black side bars). An author-set width caps how wide the frame grows.
    const maxW = widget.data.width ? Number(widget.data.width) : undefined;
    return (
      <Box key={widget.id} mb="sm" style={{ maxWidth: maxW, width: "100%" }}>
        <AspectRatio ratio={16 / 9}>
          <iframe
            src={embedUrl}
            style={{ border: 0, display: "block", width: "100%", height: "100%" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </AspectRatio>
      </Box>
    );
  }
  if (widget.type === "link") {
    return widget.data.linkType ? (
      <LinkRenderer key={widget.id} data={widget.data} />
    ) : null;
  }
  if (widget.type === "accordion") {
    const items = (widget.data.items as AccordionItem[]) ?? [];
    if (!items.length) return null;
    return (
      <Accordion key={widget.id} mb="sm">
        {items.map((item) => (
          <Accordion.Item key={item.id} value={item.id}>
            <Accordion.Control>{item.title}</Accordion.Control>
            <Accordion.Panel>
              {item.content ? (
                <Box dangerouslySetInnerHTML={{ __html: tiptapToHtml(item.content) }} />
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );
  }
  if (widget.type === "gallery") {
    const imgs = (widget.data.images as GalleryImage[]) ?? [];
    if (!imgs.length) return null;
    return (
      <SimpleGrid key={widget.id} cols={{ base: 2, sm: 3 }} spacing={6} mb="md">
        {imgs.map((img, idx) => (
          <Image key={idx} src={img.cdnUrl} radius="sm" fit="cover" style={{ aspectRatio: "1 / 1" }} />
        ))}
      </SimpleGrid>
    );
  }
  if (widget.type === "section") {
    const sectionData = widget.data as unknown as MixedContentData;
    if (!sectionData.columns?.length) return null;
    return (
      <Box
        key={widget.id}
        mb="sm"
        style={{ display: "flex", gap: 16, alignItems: "flex-start", width: "100%" }}
      >
        {sectionData.columns.map((col) => (
          <Box key={col.id} style={{ flex: col.width, minWidth: 0 }}>
            {col.widgets.map((w) => renderWidget(w))}
          </Box>
        ))}
      </Box>
    );
  }
  return null;
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function BlockRenderer({ block }: { block: Block }) {
  // Mixed Content is the only built-in block type — its column widgets
  // (text, video, link, accordion, gallery, section) cover the primitives
  // an editor needs.
  if (block.type !== "mixed-content") return null;
  const d = block.data as unknown as MixedContentData;
  if (!d.columns?.length) return null;
  return (
    <Box
      mb="md"
      style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}
    >
      {d.columns.map((col) => (
        <Box key={col.id} style={{ flex: col.width, minWidth: "min(180px, 100%)" }}>
          {col.widgets.map((widget) => renderWidget(widget))}
        </Box>
      ))}
    </Box>
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

/** Parse a free-text price string like "12,34" or "12.34" into a number.
 *  Empty / invalid / non-positive → 0. */
function parsePrice(v: unknown): number {
  if (typeof v !== "string") return 0;
  const s = v.replace(",", ".").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const eurFmt = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatEur(n: number): string {
  return eurFmt.format(n);
}

// ─── Industrial Clarity design tokens (scoped to product-item view) ──────────

const D = {
  primary: "#496800",
  primaryHover: "#3a5300",
  primaryContainer: "#9acb34",
  onSurface: "#0b1c30",
  onSurfaceVariant: "#434937",
  outlineVariant: "#c3c9b1",
  surface: "#f8f9ff",
  surfaceLow: "#eff4ff",
  surfaceMid: "#e5eeff",
  surfaceHigh: "#dce9ff",
  surfaceLowest: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
} as const;

// Lucide-style stroked SVG icons (avoid adding lucide-react to frontend deps)
function Icon({ d, size = 20, fill }: { d: string; size?: number; fill?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path d={d} />
    </svg>
  );
}
const IconChevronRight = ({ size = 16 }: { size?: number }) => <Icon size={size} d="M9 6l6 6-6 6" />;
const IconChevronDown = ({ size = 20 }: { size?: number }) => <Icon size={size} d="M6 9l6 6 6-6" />;
const IconShare = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51l6.83 3.98" />
    <path d="M15.41 6.51L8.59 10.49" />
  </svg>
);
const IconLink = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07L11 5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07L13 19" />
  </svg>
);
const IconMail = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
const IconCheckCircle = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const IconTruck = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <rect x="1" y="6" width="13" height="11" rx="1" />
    <path d="M14 9h4l3 3v5h-7z" />
    <circle cx="6" cy="18.5" r="1.5" />
    <circle cx="17" cy="18.5" r="1.5" />
  </svg>
);
const IconSend = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

function PriceValue({ amount, size = "xl" }: { amount: number; size?: "md" | "lg" | "xl" }) {
  const { t } = useStrings();
  const fontSize = size === "xl" ? 36 : size === "lg" ? 28 : 20;
  const lineHeight = size === "xl" ? "44px" : size === "lg" ? "36px" : "28px";
  return (
    <Stack gap={2} align="flex-end" style={{ textAlign: "right" }}>
      <Text fw={size === "md" ? 700 : 600} style={{ fontSize, lineHeight, color: D.primary, letterSpacing: "-0.02em" }}>
        {formatEur(amount)}
      </Text>
      {size === "xl" && (
        <Text style={{ fontSize: 12, lineHeight: "16px", fontWeight: 500, color: D.onSurfaceVariant }}>
          {t("product.price_vat_suffix")}
        </Text>
      )}
    </Stack>
  );
}

interface ConfiguratorState {
  total: number;
  hasAnySelection: boolean;
  controls: React.ReactNode;
}

// Shared Mantine Select styles tuned to the Industrial Clarity spec:
// 48px height, 4px radius, surface-low background, outline-variant border,
// thickens to 2px primary on focus.
const SELECT_STYLES = {
  root: { width: "100%" },
  label: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.05em",
    color: D.onSurfaceVariant,
    marginBottom: 8,
    textTransform: "uppercase" as const,
  },
  input: {
    height: 48,
    background: D.surface,
    borderColor: D.outlineVariant,
    borderRadius: 4,
    fontSize: 16,
    color: D.onSurface,
    paddingLeft: 16,
    paddingRight: 36,
  },
  section: { color: D.onSurfaceVariant },
};

interface GroupLabels {
  group1: string;
  group2: string;
  group3: string;
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

  const kOptions = konstrukcija.map((r) => ({
    value: r.id,
    label: parsePrice(r.cijena) > 0
      ? `${r.naziv || unnamed} — ${formatEur(parsePrice(r.cijena))}`
      : r.naziv || unnamed,
  }));

  const gOptions = grafika.map((r) => {
    const priceForK = selectedK ? parsePrice(r.cijene[selectedK.id]) : 0;
    return {
      value: r.id,
      label: priceForK > 0
        ? `${r.naziv || unnamed} — ${formatEur(priceForK)}`
        : r.naziv || unnamed,
    };
  });

  const bOptions = baza.map((r) => ({
    value: r.id,
    label: parsePrice(r.cijena) > 0
      ? `${r.naziv || unnamed} — ${formatEur(parsePrice(r.cijena))}`
      : r.naziv || unnamed,
  }));

  const controls = (
    <Stack gap={24}>
      {konstrukcija.length > 0 && (
        <Select
          label={labels.group1 || t("product.option_konstrukcija")}
          placeholder={placeholder}
          data={kOptions}
          value={kId}
          onChange={handleK}
          allowDeselect
          clearable
          styles={SELECT_STYLES}
        />
      )}
      {grafika.length > 0 && (
        <Select
          label={labels.group2 || t("product.option_grafika")}
          placeholder={group2Disabled ? t("product.option_locked") : placeholder}
          data={gOptions}
          value={gId}
          onChange={setGId}
          disabled={group2Disabled}
          allowDeselect
          clearable
          styles={SELECT_STYLES}
        />
      )}
      {baza.length > 0 && (
        <Select
          label={labels.group3 || t("product.option_baza")}
          placeholder={placeholder}
          data={bOptions}
          value={bId}
          onChange={setBId}
          allowDeselect
          clearable
          styles={SELECT_STYLES}
        />
      )}
    </Stack>
  );

  return { total, hasAnySelection: Boolean(kId || gId || bId), controls };
}

function ProductItemView({ page }: { page: Page }) {
  const { locale } = useRender();
  const { defaultLocale } = useLocaleConfig();
  const { t } = useStrings();
  const block = page.blocks?.find((b) => b.type === "product-item");
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

  const tabs = (d.additionalInfo?.tabs ?? []).filter((t) => t && t.id);
  const [activeTabId, setActiveTabId] = useState<string | null>(tabs[0]?.id ?? null);
  // Match the design's tabs→accordion swap at 768px. `getInitialValueInEffect:false`
  // makes the first render reflect the real viewport, avoiding a tabs→accordion
  // flicker on mobile when the page hydrates.
  const isMobileInfo = useMediaQuery("(max-width: 767.99px)", false, { getInitialValueInEffect: false });
  // Mobile accordion: independent multi-open, first tab open by default.
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

  const homeHref = `/${locale}/`;
  const crumbStyle: React.CSSProperties = {
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 500,
    color: D.onSurfaceVariant,
  };
  const crumbActiveStyle: React.CSSProperties = {
    ...crumbStyle,
    color: D.primary,
    fontWeight: 600,
  };

  return (
    <article style={{ color: D.onSurface }}>
      {/* Breadcrumbs — Home → all ancestors (root first) → current page.
          Ancestors come from the by-slug payload's `ancestors` array, already
          ordered root → immediate parent. We resolve the requested-locale slot,
          falling back to defaultLocale's title (italic, unlinked) when the
          requested locale's translation is inactive or missing. */}
      <Group gap={8} mb={{ base: 16, md: 32 }} wrap="wrap" style={{ overflow: "hidden" }}>
        <Anchor component={Link} to={homeHref} underline="never" style={crumbStyle}>
          {t("product.breadcrumb_home")}
        </Anchor>
        {(page.ancestors ?? []).map((a, idx) => {
          const ancestors = page.ancestors ?? [];
          const inLoc = a.locales[locale];
          const fallback = a.locales[defaultLocale];
          // Hierarchical breadcrumb: each ancestor's URL is the cumulative slug
          // path from the root down to it. Linkable only when EVERY segment on
          // that chain has an active translation in this locale — otherwise the
          // nested URL would 404.
          const chain = ancestors.slice(0, idx + 1).map((x) => x.locales[locale]);
          const fullyActive = chain.every((c) => !!(c?.active && c.slug));
          const linkable = fullyActive;
          const href = `/${locale}/${chain.map((c) => c!.slug).join("/")}`;
          const title = inLoc?.title || fallback?.title || a.type;
          return (
            <Group key={a.id} gap={8} wrap="nowrap">
              <Box c={D.onSurfaceVariant} style={{ display: "flex" }}><IconChevronRight /></Box>
              {linkable ? (
                <Anchor
                  component={Link}
                  to={href}
                  underline="never"
                  style={crumbStyle}
                >
                  {title}
                </Anchor>
              ) : (
                <Text
                  component="span"
                  style={{ ...crumbStyle, fontStyle: inLoc?.active ? undefined : "italic" }}
                >
                  {title}
                </Text>
              )}
            </Group>
          );
        })}
        <Box c={D.onSurfaceVariant} style={{ display: "flex" }}><IconChevronRight /></Box>
        <Text component="span" style={crumbActiveStyle}>{page.title}</Text>
      </Group>

      {/* Product title — headline-xl (48/700) desktop, headline-xl-mobile (32/700) */}
      <Box mb={{ base: 32, md: 48 }}>
        <Text
          component="h1"
          style={{
            margin: 0,
            color: D.onSurface,
            fontSize: "clamp(32px, 5vw, 48px)",
            lineHeight: 1.16,
            letterSpacing: "-0.02em",
            fontWeight: 700,
          }}
        >
          {page.title}
        </Text>
        {altTitle && (
          <Text mt={8} style={{ fontSize: 18, lineHeight: "28px", color: D.onSurfaceVariant }}>
            {altTitle}
          </Text>
        )}
      </Box>

      {/* Main grid — single column under lg, 7/5 split at lg+ */}
      <Grid gutter={{ base: 32, lg: 48 }}>
        {/* Left column: image + thumbnails + description + social share */}
        <Grid.Col span={{ base: 12, lg: 7 }} order={{ base: 2, lg: 1 }}>
          {activeImage && (
            <Box
              mb={16}
              style={{
                background: D.surfaceLow,
                border: `1px solid ${D.outlineVariant}`,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <AspectRatio ratio={1}>
                <Image
                  key={activeImage.mediaId}
                  src={activeImage.cdnUrl}
                  alt={page.title}
                  fit="cover"
                  style={{ transition: "opacity 200ms" }}
                />
              </AspectRatio>
            </Box>
          )}

          {allImages.length > 1 && (
            <Box
              mb={32}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 12,
              }}
            >
              {allImages.slice(0, 10).map((img, i) => {
                const isActive = i === activeImageIndex;
                return (
                  <UnstyledButton
                    key={img.mediaId}
                    onClick={() => setActiveImageIndex(i)}
                    aria-label={`${t("product.aria_view_image")} ${i + 1}`}
                    aria-current={isActive}
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 4,
                      overflow: "hidden",
                      background: D.surfaceLow,
                      border: isActive
                        ? `2px solid ${D.primary}`
                        : `1px solid ${D.outlineVariant}`,
                      transition: "border-color 150ms",
                    }}
                  >
                    <Image src={img.cdnUrl} fit="cover" h="100%" w="100%" loading="lazy" />
                  </UnstyledButton>
                );
              })}
            </Box>
          )}

          {description && (
            <Stack gap={24}>
              {/* Sub-heading sits above the long-form copy. Static copy because
                  the block model exposes only a plain-text description today. */}
              <Text
                component="h2"
                style={{
                  margin: 0,
                  fontSize: 20,
                  lineHeight: "28px",
                  fontWeight: 600,
                  color: D.onSurface,
                }}
              >
                {t("product.about_heading")}
              </Text>
              <Text
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 16,
                  lineHeight: "24px",
                  color: D.onSurfaceVariant,
                }}
              >
                {description}
              </Text>
            </Stack>
          )}

          {/* Social share */}
          <Group gap={16} mt={32} align="center">
            <Text
              style={{
                fontSize: 14,
                lineHeight: "16px",
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: D.onSurface,
              }}
            >
              {t("product.share_label")}
            </Text>
            <Group gap={8}>
              {[
                { label: t("product.share_native"), icon: <IconShare />, onClick: () => {
                  if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
                    void (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({ title: page.title, url: window.location.href }).catch(() => {});
                  }
                } },
                { label: t("product.share_copy_link"), icon: <IconLink />, onClick: () => {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    void navigator.clipboard.writeText(window.location.href).catch(() => {});
                  }
                } },
                { label: t("product.share_email"), icon: <IconMail />, onClick: () => {
                  window.location.href = `mailto:?subject=${encodeURIComponent(page.title)}&body=${encodeURIComponent(window.location.href)}`;
                } },
              ].map((b) => (
                <UnstyledButton
                  key={b.label}
                  aria-label={b.label}
                  onClick={b.onClick}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 4,
                    border: `1px solid ${D.outlineVariant}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: D.onSurfaceVariant,
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = D.surfaceHigh; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {b.icon}
                </UnstyledButton>
              ))}
            </Group>
          </Group>
        </Grid.Col>

        {/* Right column: configurator card (sticky at lg+) */}
        <Grid.Col span={{ base: 12, lg: 5 }} order={{ base: 1, lg: 2 }}>
          <Box
            p={{ base: 24, md: 32 }}
            style={{
              background: D.surfaceLowest,
              border: `1px solid ${D.outlineVariant}`,
              borderRadius: 4,
              position: "sticky",
              top: 96,
            }}
          >
            <Text
              component="h3"
              mb={24}
              style={{
                margin: 0,
                fontSize: 20,
                lineHeight: "28px",
                fontWeight: 600,
                color: D.onSurface,
              }}
            >
              {t("product.configurator_heading")}
            </Text>

            {priceMode === "configurator" && (
              <Box mb={32}>{configurator.controls}</Box>
            )}

            {/* Price row */}
            <Box
              mb={32}
              pt={24}
              style={{
                borderTop: `1px solid ${D.outlineVariant}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
              }}
            >
              <Text style={{ fontSize: 16, lineHeight: "24px", color: D.onSurfaceVariant }}>
                {effectiveInquiry ? t("product.price_inquiry_label") : t("product.price_estimated_label")}
              </Text>
              {!effectiveInquiry && displayPrice > 0 ? (
                <PriceValue amount={displayPrice} />
              ) : (
                <Text style={{ fontSize: 14, color: D.onSurfaceVariant, fontStyle: "italic" }}>
                  —
                </Text>
              )}
            </Box>

            {/* CTA — visible on all viewports (mobile sticky bar mirrors it).
                Inquiry-style project, so the label stays "Pošaljite upit". */}
            <UnstyledButton
              onClick={() => { /* Pošaljite upit — wiring TBD */ }}
              style={{
                width: "100%",
                background: D.primary,
                color: "#fff",
                padding: "16px 32px",
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                transition: "background 150ms, transform 100ms",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = D.primaryHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = D.primary; }}
            >
              <IconSend />
              {t("product.cta_send_inquiry")}
            </UnstyledButton>

            {/* Trust row */}
            <Group justify="center" gap={16} mt={16}>
              <Group gap={4} align="center">
                <Box c={D.primary} style={{ display: "flex" }}><IconCheckCircle /></Box>
                <Text style={{ fontSize: 12, lineHeight: "16px", fontWeight: 500, color: D.onSurfaceVariant }}>
                  {t("product.trust_available")}
                </Text>
              </Group>
              <Group gap={4} align="center">
                <Box c={D.primary} style={{ display: "flex" }}><IconTruck /></Box>
                <Text style={{ fontSize: 12, lineHeight: "16px", fontWeight: 500, color: D.onSurfaceVariant }}>
                  {t("product.trust_fast_delivery")}
                </Text>
              </Group>
            </Group>
          </Box>
        </Grid.Col>
      </Grid>

      {/* Info section — horizontal tabs at ≥768px, vertical multi-open accordion below.
          Both branches read from the same `tabs` array. */}
      {tabs.length > 0 && (
        <Box
          mt={{ base: 64, md: 80 }}
          pt={48}
          style={{ borderTop: `1px solid ${D.outlineVariant}` }}
        >
          {isMobileInfo ? (
            <Accordion
              value={openInfoItem}
              onChange={setOpenInfoItem}
              chevron={<IconChevronDown />}
              styles={{
                root: { background: "transparent" },
                item: {
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${D.outlineVariant}`,
                  borderRadius: 0,
                },
                control: { padding: "16px 0", background: "transparent" },
                label: {
                  padding: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                },
                chevron: { color: D.onSurfaceVariant, transition: "transform 250ms" },
                content: { padding: "4px 0 24px" },
                panel: { background: "transparent" },
              }}
            >
              {tabs.map((tab) => {
                const isOpen = openInfoItem === tab.id;
                return (
                  <Accordion.Item key={tab.id} value={tab.id}>
                    <Accordion.Control style={{ color: isOpen ? D.primary : D.onSurface }}>
                      {tab.title || t("product.option_unnamed")}
                    </Accordion.Control>
                    <Accordion.Panel>
                      {tab.content ? (
                        <Box
                          style={{ fontSize: 16, lineHeight: "24px", color: D.onSurfaceVariant }}
                          dangerouslySetInnerHTML={{ __html: tiptapToHtml(tab.content) }}
                        />
                      ) : (
                        <Text style={{ fontSize: 14, color: D.onSurfaceVariant }}>
                          {t("product.tab_empty")}
                        </Text>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          ) : (
            <Tabs
              value={activeTabId}
              onChange={setActiveTabId}
              variant="default"
              keepMounted={false}
              styles={{
                list: {
                  gap: 32,
                  borderBottom: `1px solid ${D.outlineVariant}`,
                  marginBottom: 32,
                  flexWrap: "nowrap",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  whiteSpace: "nowrap",
                },
                tab: {
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: D.onSurfaceVariant,
                  paddingBottom: 16,
                  paddingTop: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                  borderBottom: "2px solid transparent",
                  borderRadius: 0,
                  background: "transparent",
                },
                tabLabel: { whiteSpace: "nowrap" },
              }}
            >
              <Tabs.List>
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  return (
                    <Tabs.Tab
                      key={tab.id}
                      value={tab.id}
                      style={{
                        color: isActive ? D.primary : D.onSurfaceVariant,
                        borderBottomColor: isActive ? D.primaryContainer : "transparent",
                      }}
                    >
                      {tab.title || t("product.option_unnamed")}
                    </Tabs.Tab>
                  );
                })}
              </Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Panel key={tab.id} value={tab.id} pt={0} style={{ minHeight: 300 }}>
                  {tab.content ? (
                    <Box
                      style={{ fontSize: 16, lineHeight: "24px", color: D.onSurfaceVariant }}
                      dangerouslySetInnerHTML={{ __html: tiptapToHtml(tab.content) }}
                    />
                  ) : (
                    <Text style={{ fontSize: 14, color: D.onSurfaceVariant }}>{t("product.tab_empty")}</Text>
                  )}
                </Tabs.Panel>
              ))}
            </Tabs>
          )}
        </Box>
      )}

      {/* Sticky mobile bottom bar */}
      <Box
        hiddenFrom="lg"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: D.surface,
          borderTop: `1px solid ${D.outlineVariant}`,
          padding: 16,
          zIndex: 100,
          boxShadow: "0 -4px 10px rgba(0,0,0,0.05)",
        }}
      >
        <Group justify="space-between" wrap="nowrap" gap={16}>
          <Stack gap={2} style={{ flexShrink: 0 }}>
            <Text style={{ fontSize: 12, lineHeight: "16px", fontWeight: 500, color: D.onSurfaceVariant }}>
              {effectiveInquiry ? t("product.mobile_price_label") : t("product.mobile_total_label")}
            </Text>
            {!effectiveInquiry && displayPrice > 0 ? (
              <PriceValue amount={displayPrice} size="md" />
            ) : (
              <Text style={{ fontSize: 20, lineHeight: "28px", fontWeight: 700, color: D.primary }}>
                {t("product.mobile_on_inquiry")}
              </Text>
            )}
          </Stack>
          <UnstyledButton
            onClick={() => { /* Pošaljite upit — wiring TBD */ }}
            style={{
              flex: 1,
              background: D.primary,
              color: "#fff",
              padding: "12px 24px",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <IconSend />
            POŠALJITE UPIT
          </UnstyledButton>
        </Group>
      </Box>
      {/* Spacer so content isn't covered by the sticky mobile bar */}
      <Box hiddenFrom="lg" h={88} />
    </article>
  );
}

// ─── Default view ─────────────────────────────────────────────────────────────

function DefaultView({ page }: { page: Page }) {
  return (
    <article>
      <Title order={1} mb="lg">{page.title}</Title>
      {page.blocks?.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </article>
  );
}

// ─── Article view ───────────────────────────────────────────────────────────
//
// Article detail page: the type badge (`articleType`) + the large article photo
// ("fotografija članka", `articlePhoto`) above the title, then the Mixed Content
// body. The smaller `cardPhoto` is only used by the news listing cards.

function ArticleView({ page }: { page: Page }) {
  const td = page.typeData ?? {};
  const articleType = typeof td.articleType === "string" ? td.articleType : "";
  const photo =
    td.articlePhoto && typeof td.articlePhoto === "object" &&
    typeof (td.articlePhoto as { cdnUrl?: unknown }).cdnUrl === "string"
      ? (td.articlePhoto as { cdnUrl: string }).cdnUrl
      : null;

  return (
    <article>
      {articleType && (
        <Badge variant="light" mb="sm" size="lg">{articleType}</Badge>
      )}
      <Title order={1} mb="lg">{page.title}</Title>
      {photo && (
        <Image src={photo} alt={page.title} radius="md" mb="xl" />
      )}
      {page.blocks?.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </article>
  );
}

// ─── EU project view ──────────────────────────────────────────────────────────
//
// EU-project detail page: the main photo ("glavna fotografija", `mainPhoto`)
// above the title, then the Mixed Content body. No badges or other chrome.

function EuProjectItemView({ page }: { page: Page }) {
  const td = page.typeData ?? {};
  const photo =
    td.mainPhoto && typeof td.mainPhoto === "object" &&
    typeof (td.mainPhoto as { cdnUrl?: unknown }).cdnUrl === "string"
      ? (td.mainPhoto as { cdnUrl: string }).cdnUrl
      : null;

  return (
    <article>
      <Title order={1} mb="lg">{page.title}</Title>
      {photo && (
        <Image src={photo} alt={page.title} radius="md" mb="xl" />
      )}
      {page.blocks?.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </article>
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
        <ArticleView page={page} />
      ) : page.type === "eu-projects" ? (
        <EuProjectsView page={page} locale={activeLocale} />
      ) : page.type === "eu-project-item" ? (
        <EuProjectItemView page={page} />
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
