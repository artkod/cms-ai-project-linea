import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import {
  Title,
  Text,
  Loader,
  Box,
  Button,
  Anchor,
  SimpleGrid,
  Image,
  Accordion,
  Group,
  Select,
  Stack,
  Tabs,
} from "@mantine/core";
import { Link } from "react-router";
import { getPageBySlug, type Page, type Block, type LinkPagesMap } from "@/lib/api";
import { tiptapToHtml } from "@/lib/tiptapRenderer";
import { usePageAlternates } from "@/lib/locale";

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
    // Resolve pageId → /{locale}/{slug} via the page-payload `linkPages` map.
    // Fall back to /{locale}/ when target page has no active translation here.
    const pageId = (data.pageId as string) || "";
    const resolved = pageId ? linkPages[pageId]?.[locale] : null;
    href = resolved?.active && resolved.slug ? `/${locale}/${resolved.slug}` : `/${locale}/`;
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
    return (
      <Box key={widget.id} mb="sm">
        <iframe
          src={embedUrl}
          width={widget.data.width ? Number(widget.data.width) : "100%"}
          height={widget.data.height ? Number(widget.data.height) : 315}
          style={{ border: 0, display: "block", maxWidth: "100%" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
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

function PriceDisplay({ amount }: { amount: number }) {
  return (
    <Group gap={6} align="baseline">
      <Text fw={700} size="xl">{formatEur(amount)}</Text>
      <Text size="sm" c="dimmed">+ PDV</Text>
    </Group>
  );
}

function PriceConfigurator({
  konstrukcija,
  grafika,
  baza,
}: {
  konstrukcija: KonstrukcijaRow[];
  grafika: GrafikaRow[];
  baza: BazaRow[];
}) {
  // Dropdowns start unselected with an "Odaberite" placeholder so users
  // make a conscious pick rather than landing on a pre-filled total.
  const [kId, setKId] = useState<string | null>(null);
  const [gId, setGId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  const selectedK = konstrukcija.find((r) => r.id === kId) ?? null;
  const selectedG = grafika.find((r) => r.id === gId) ?? null;
  const selectedB = baza.find((r) => r.id === bId) ?? null;

  // Grafika price depends on which Konstrukcija is selected.
  const grafikaPrice = selectedG && selectedK ? parsePrice(selectedG.cijene[selectedK.id]) : 0;
  const konstrukcijaPrice = selectedK ? parsePrice(selectedK.cijena) : 0;
  const bazaPrice = selectedB ? parsePrice(selectedB.cijena) : 0;

  const total = konstrukcijaPrice + grafikaPrice + bazaPrice;

  const kOptions = konstrukcija.map((r) => ({
    value: r.id,
    // Pre-formatted label so users see option price at-a-glance.
    label: parsePrice(r.cijena) > 0
      ? `${r.naziv} — ${formatEur(parsePrice(r.cijena))}`
      : r.naziv || "(bez naziva)",
  }));

  const gOptions = grafika.map((r) => {
    const priceForK = selectedK ? parsePrice(r.cijene[selectedK.id]) : 0;
    return {
      value: r.id,
      label: priceForK > 0
        ? `${r.naziv} — ${formatEur(priceForK)}`
        : r.naziv || "(bez naziva)",
    };
  });

  const bOptions = baza.map((r) => ({
    value: r.id,
    label: parsePrice(r.cijena) > 0
      ? `${r.naziv} — ${formatEur(parsePrice(r.cijena))}`
      : r.naziv || "(bez naziva)",
  }));

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        {konstrukcija.length > 0 && (
          <Select
            label="Konstrukcija"
            placeholder="Odaberite"
            data={kOptions}
            value={kId}
            onChange={setKId}
            allowDeselect={false}
          />
        )}
        {grafika.length > 0 && (
          <Select
            label="Grafika"
            placeholder="Odaberite"
            data={gOptions}
            value={gId}
            onChange={setGId}
            allowDeselect={false}
          />
        )}
        {baza.length > 0 && (
          <Select
            label="Baza"
            placeholder="Odaberite"
            data={bOptions}
            value={bId}
            onChange={setBId}
            allowDeselect={false}
          />
        )}
      </SimpleGrid>
      <PriceDisplay amount={total} />
    </Stack>
  );
}

function ProductItemView({ page }: { page: Page }) {
  const block = page.blocks?.find((b) => b.type === "product-item");
  const d = (block?.data ?? {}) as ProductItemBlockData;

  const altTitle = d.altTitle?.trim() || "";
  const mainPhoto = d.mainPhoto ?? null;
  const gallery = d.galleryImages ?? [];
  const description = d.description?.trim() || "";

  const fixedPrice = parsePrice(d.priceEur);
  const k = d.konfiguratorCijene?.konstrukcija ?? [];
  const g = d.konfiguratorCijene?.grafika ?? [];
  const b = d.konfiguratorCijene?.baza ?? [];

  // Konfigurator counts as "has prices" only when at least one cijena across
  // all categories is > 0 — empty rows shouldn't trigger the configurator.
  const hasKonfiguratorPrices = useMemo(() => {
    if (k.some((r) => parsePrice(r.cijena) > 0)) return true;
    if (g.some((r) => Object.values(r.cijene ?? {}).some((c) => parsePrice(c) > 0))) return true;
    if (b.some((r) => parsePrice(r.cijena) > 0)) return true;
    return false;
  }, [k, g, b]);

  const tabs = (d.additionalInfo?.tabs ?? []).filter((t) => t && t.id);
  const [activeTabId, setActiveTabId] = useState<string | null>(tabs[0]?.id ?? null);

  let priceArea: React.ReactNode;
  if (fixedPrice > 0) {
    priceArea = <PriceDisplay amount={fixedPrice} />;
  } else if (hasKonfiguratorPrices) {
    priceArea = <PriceConfigurator konstrukcija={k} grafika={g} baza={b} />;
  } else {
    priceArea = (
      <Button color="teal" size="md" onClick={() => { /* Pošaljite upit — wiring TBD */ }}>
        Pošaljite upit
      </Button>
    );
  }

  return (
    <article>
      <Title order={1} mb={altTitle ? 4 : "md"}>{page.title}</Title>
      {altTitle && (
        <Text size="lg" c="dimmed" mb="md">{altTitle}</Text>
      )}

      {mainPhoto && (
        <Image
          src={mainPhoto.cdnUrl}
          alt={page.title}
          radius="md"
          mb="md"
          fit="cover"
          style={{ maxHeight: 480, width: "100%" }}
        />
      )}

      {gallery.length > 0 && (
        <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing={8} mb="md">
          {gallery.map((img) => (
            <Image
              key={img.mediaId}
              src={img.cdnUrl}
              radius="sm"
              fit="cover"
              style={{ aspectRatio: "1 / 1" }}
            />
          ))}
        </SimpleGrid>
      )}

      {description && (
        <Text mb="md" style={{ whiteSpace: "pre-wrap" }}>{description}</Text>
      )}

      <Box mb="lg">{priceArea}</Box>

      {tabs.length > 0 && (
        <Tabs
          value={activeTabId}
          onChange={setActiveTabId}
          variant="default"
          keepMounted={false}
        >
          <Tabs.List grow>
            {tabs.map((tab) => (
              <Tabs.Tab
                key={tab.id}
                value={tab.id}
                styles={{
                  tab: { minWidth: 0 },
                  tabLabel: {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  },
                }}
              >
                {tab.title || "(bez naziva)"}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Panel key={tab.id} value={tab.id} pt="md">
              {tab.content ? (
                <Box dangerouslySetInnerHTML={{ __html: tiptapToHtml(tab.content) }} />
              ) : (
                <Text c="dimmed" size="sm">Nema sadržaja.</Text>
              )}
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function PageView() {
  const { locale, slug } = useParams<{ locale: string; slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const previewToken = searchParams.get("previewToken") ?? undefined;
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const { setAlternates } = usePageAlternates();

  useEffect(() => {
    if (!slug || !locale) return;
    setLoading(true);
    getPageBySlug(locale, slug, previewToken)
      .then((data) => {
        if (!data || (!previewToken && data.status !== "published")) {
          navigate("/", { replace: true });
        } else {
          setPage(data);
          setAlternates(data.alternates ?? null);
        }
      })
      .catch(() => navigate("/", { replace: true }))
      .finally(() => setLoading(false));
  }, [locale, slug, previewToken, navigate, setAlternates]);

  useEffect(() => {
    return () => setAlternates(null);
  }, [setAlternates]);

  if (loading) return <Loader />;
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
      ) : (
        <DefaultView page={page} />
      )}
    </RenderContext.Provider>
  );
}
