import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Grid,
  Group,
  Image,
  Loader,
  NumberInput,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { getAllPages, type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";

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

const eurFmt = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

const PAGE_SIZE_OPTIONS = ["12", "24", "48"];

// ─── View ─────────────────────────────────────────────────────────────────────

export function AllProductsView({ page }: { page: Page }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();

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

  // ─── Filter form (draft) vs. applied filters ────────────────────────────────
  // Sidebar edits accumulate in the draft; nothing re-filters the grid until
  // "Apply filters" copies the draft into the applied state.
  const [searchDraft, setSearchDraft] = useState("");
  const [catDraft, setCatDraft] = useState<string[]>([]);
  const [subDraft, setSubDraft] = useState<string[]>([]);
  // Kept as the raw NumberInput value (number or in-progress string) and parsed
  // to a number only at apply time, so decimals can be typed without resetting.
  const [minDraft, setMinDraft] = useState<number | string>("");
  const [maxDraft, setMaxDraft] = useState<number | string>("");

  const [applied, setApplied] = useState<{
    search: string;
    catIds: string[];
    subIds: string[];
    min: number | null;
    max: number | null;
  }>({ search: "", catIds: [], subIds: [], min: null, max: null });

  // Display controls apply immediately (they're not part of the filter form).
  const [sort, setSort] = useState<SortKey>("newest");
  const [pageSize, setPageSize] = useState(12);
  const [pageNum, setPageNum] = useState(1);

  // Subcategory options narrow to the picked categories (if any). Drop drafted
  // subcategory ids that fall outside the current category selection.
  const visibleSubs = useMemo(() => {
    const subs = catDraft.length
      ? categoryPages.filter((c) => c.parentId && catDraft.includes(c.parentId))
      : categoryPages;
    return [...subs].sort((a, b) => a.title.localeCompare(b.title));
  }, [categoryPages, catDraft]);

  useEffect(() => {
    const valid = new Set(visibleSubs.map((s) => s.id));
    setSubDraft((prev) => prev.filter((id) => valid.has(id)));
  }, [visibleSubs]);

  const categoryOptions = useMemo(
    () => [...productsPages].sort((a, b) => a.title.localeCompare(b.title)),
    [productsPages],
  );

  function toBound(v: number | string): number | null {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function applyFilters() {
    setApplied({
      search: searchDraft.trim(),
      catIds: catDraft,
      subIds: subDraft,
      min: toBound(minDraft),
      max: toBound(maxDraft),
    });
    setPageNum(1);
  }

  function resetFilters() {
    setSearchDraft("");
    setCatDraft([]);
    setSubDraft([]);
    setMinDraft("");
    setMaxDraft("");
    setApplied({ search: "", catIds: [], subIds: [], min: null, max: null });
    setPageNum(1);
  }

  const filtered = useMemo(() => {
    const q = applied.search.toLowerCase();
    return cards.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      if (applied.catIds.length && !applied.catIds.includes(c.productsId)) return false;
      if (applied.subIds.length && !applied.subIds.includes(c.categoryId)) return false;
      // A price bound excludes inquiry-only products (no comparable price).
      if (applied.min != null || applied.max != null) {
        if (!c.price) return false;
        if (applied.min != null && c.price.amount < applied.min) return false;
        if (applied.max != null && c.price.amount > applied.max) return false;
      }
      return true;
    });
  }, [cards, applied]);

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

  if (loading) {
    return (
      <Box py="xl" ta="center">
        <Loader />
      </Box>
    );
  }

  const sortData = [
    { value: "newest", label: t("allproducts.sort_newest") },
    { value: "oldest", label: t("allproducts.sort_oldest") },
    { value: "name", label: t("allproducts.sort_name") },
    { value: "price_asc", label: t("allproducts.sort_price_asc") },
    { value: "price_desc", label: t("allproducts.sort_price_desc") },
  ];

  return (
    <Box>
      <Title order={1} mb="lg">{page.title}</Title>

      <Grid gutter="xl">
        {/* ── Sidebar: filter form ── */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Stack gap="lg">
            <Box>
              <Text fw={600} size="sm" mb={6}>{t("allproducts.search_label")}</Text>
              <TextInput
                placeholder={t("allproducts.search_placeholder")}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
            </Box>

            {categoryOptions.length > 0 && (
              <Box>
                <Text fw={600} size="sm" mb={6}>{t("allproducts.categories_label")}</Text>
                <Checkbox.Group value={catDraft} onChange={setCatDraft}>
                  <Stack gap={8}>
                    {categoryOptions.map((c) => (
                      <Checkbox key={c.id} value={c.id} label={c.title} />
                    ))}
                  </Stack>
                </Checkbox.Group>
              </Box>
            )}

            {visibleSubs.length > 0 && (
              <Box>
                <Text fw={600} size="sm" mb={6}>{t("allproducts.subcategories_label")}</Text>
                <Chip.Group multiple value={subDraft} onChange={setSubDraft}>
                  <Group gap={8}>
                    {visibleSubs.map((s) => (
                      <Chip key={s.id} value={s.id} size="sm">{s.title}</Chip>
                    ))}
                  </Group>
                </Chip.Group>
              </Box>
            )}

            <Box>
              <Text fw={600} size="sm" mb={6}>{t("allproducts.price_label")}</Text>
              <Group gap="xs" grow wrap="nowrap" align="center">
                <NumberInput
                  placeholder={t("allproducts.price_min")}
                  value={minDraft}
                  onChange={setMinDraft}
                  min={0}
                  hideControls
                />
                <Text c="dimmed">—</Text>
                <NumberInput
                  placeholder={t("allproducts.price_max")}
                  value={maxDraft}
                  onChange={setMaxDraft}
                  min={0}
                  hideControls
                />
              </Group>
            </Box>

            <Button onClick={applyFilters}>{t("allproducts.apply_filters")}</Button>
            <Button variant="subtle" onClick={resetFilters}>{t("allproducts.reset_filters")}</Button>
          </Stack>
        </Grid.Col>

        {/* ── Results ── */}
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Group justify="space-between" align="center" mb="md" wrap="wrap">
            <Text fw={600}>
              {t("allproducts.count_prefix")} {sorted.length} {t("allproducts.count_suffix")}
            </Text>
            <Group gap="xs" align="center">
              <Text size="sm" c="dimmed">{t("allproducts.sort_label")}</Text>
              <Select
                data={sortData}
                value={sort}
                onChange={(v) => {
                  setSort((v as SortKey) ?? "newest");
                  setPageNum(1);
                }}
                allowDeselect={false}
                w={200}
              />
            </Group>
          </Group>

          {paged.length === 0 ? (
            <Box py="xl" ta="center">
              <Text c="dimmed">{t("allproducts.empty")}</Text>
            </Box>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {paged.map((c) => (
                <Card key={c.id} component={Link} to={c.url} withBorder padding="md" radius="md">
                  <Card.Section>
                    <Image
                      src={c.image ?? undefined}
                      h={180}
                      alt={c.title}
                      fallbackSrc="https://placehold.co/400x300?text=%20"
                    />
                  </Card.Section>
                  <Stack gap={6} mt="sm">
                    {c.categoryTitle && (
                      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{c.categoryTitle}</Text>
                    )}
                    <Text fw={600} lineClamp={2}>{c.title}</Text>
                    {c.description && (
                      <Text size="sm" c="dimmed" lineClamp={2}>{c.description}</Text>
                    )}
                    <Box mt={4}>
                      {c.price ? (
                        <Text fw={700}>
                          {c.price.from ? `${t("allproducts.price_from")} ` : ""}
                          {eurFmt.format(c.price.amount)}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">{t("allproducts.price_inquiry")}</Text>
                      )}
                    </Box>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}

          {sorted.length > 0 && (
            <>
              <Divider my="lg" />
              <Group justify="space-between" align="center" wrap="wrap">
                <Group gap="xs" align="center">
                  <Text size="sm" c="dimmed">{t("allproducts.per_page_label")}</Text>
                  <Select
                    data={PAGE_SIZE_OPTIONS}
                    value={String(pageSize)}
                    onChange={(v) => {
                      setPageSize(Number(v) || 12);
                      setPageNum(1);
                    }}
                    allowDeselect={false}
                    w={90}
                  />
                </Group>
                <Pagination total={totalPages} value={currentPage} onChange={setPageNum} />
              </Group>
            </>
          )}
        </Grid.Col>
      </Grid>
    </Box>
  );
}
