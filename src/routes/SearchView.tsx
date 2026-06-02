import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  Box,
  Button,
  Card,
  Divider,
  Group,
  Image,
  Loader,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { getAllPages, type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";
import { computeCardPrice } from "./AllProductsView";

// The search page renders product-item results that match the `?q=` query.
// There is no search input in the chrome yet (it lands in the navigation
// later) — the query is read straight from the URL, so this view works the
// moment a `?q=…` is appended. Layout mirrors AllProductsView's results
// column but without the left filter sidebar: a count headline, a sort
// dropdown, the same product cards, and pagination.

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

const PAGE_SIZE_OPTIONS = ["12", "24", "48"];

const eurFmt = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function SearchView({ page }: { page: Page }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();

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

  const sortData = [
    { value: "newest", label: t("allproducts.sort_newest") },
    { value: "oldest", label: t("allproducts.sort_oldest") },
    { value: "name", label: t("allproducts.sort_name") },
    { value: "price_asc", label: t("allproducts.sort_price_asc") },
    { value: "price_desc", label: t("allproducts.sort_price_desc") },
  ];

  if (loading) {
    return (
      <Box py="xl" ta="center">
        <Loader />
      </Box>
    );
  }

  // ── No query yet (search input lands in the nav later) ──
  if (!query) {
    return (
      <Box>
        <Title order={1} mb="lg">{page.title}</Title>
        <Box py={64} ta="center">
          <Text c="dimmed">{t("search.prompt")}</Text>
        </Box>
      </Box>
    );
  }

  // ── No results template ──
  if (sorted.length === 0) {
    return (
      <Box>
        <Title order={1} mb="lg">{page.title}</Title>
        <Stack align="center" gap="sm" py={64} style={{ textAlign: "center" }}>
          <Text size="3rem">🔍</Text>
          <Title order={3}>{t("search.empty_title")}</Title>
          <Text c="dimmed" maw={460}>
            {t("search.empty_text")} “{query}”.
          </Text>
          <Button component={Link as any} to={home} variant="light" color="teal" mt="sm">
            {t("notfound.home")}
          </Button>
        </Stack>
      </Box>
    );
  }

  // ── Results ──
  return (
    <Box>
      <Title order={1} mb="md">{page.title}</Title>

      <Group justify="space-between" align="center" mb="md" wrap="wrap">
        <Text fw={600}>
          {t("search.count_prefix")} {sorted.length} {t("search.count_suffix")} “{query}”
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
    </Box>
  );
}
