import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Container,
  Title,
  Text,
  Box,
  Group,
  Stack,
  Button,
  Badge,
  Card,
  Image,
  AspectRatio,
  SimpleGrid,
  Select,
  Loader,
  Pagination,
  Divider,
  Anchor,
} from "@mantine/core";
import { getAllPages, type Page } from "@/lib/api";

// ─── Article model (derived from child `article` pages of the news page) ───────
//
// Each article is a published `article` page whose parent is this news page.
// Content fields come from the article page's typeData:
//   articleType  → string (the Settings → Article dropdown value)
//   articlePhoto → { cdnUrl } (large/hero image)
//   cardPhoto    → { cdnUrl } (listing thumbnail)
// The short excerpt is the SEO meta description of the article in this locale.

interface ArticleCard {
  id: string;
  title: string;
  slug: string;
  type: string;
  cardImage: string | null;
  heroImage: string | null;
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
    cardImage: imgUrl(td.cardPhoto) ?? imgUrl(td.articlePhoto),
    heroImage: imgUrl(td.articlePhoto) ?? imgUrl(td.cardPhoto),
    excerpt: p.translations?.[locale]?.metaDescription ?? "",
    date: p.updatedAt ?? p.createdAt ?? "",
  };
}

// ─── UI labels (minimal, locale-aware) ─────────────────────────────────────────

const LABELS = {
  en: {
    all: "All",
    sortLabel: "Sort",
    latest: "Latest",
    oldest: "Oldest",
    read: "Read article",
    empty: "No articles yet.",
    featured: "Featured",
  },
  hr: {
    all: "Sve",
    sortLabel: "Sortiraj",
    latest: "Najnovije",
    oldest: "Najstarije",
    read: "Pročitaj članak",
    empty: "Još nema članaka.",
    featured: "Izdvojeno",
  },
} as const;

function formatDate(iso: string, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "hr" ? "hr-HR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const PAGE_SIZE = 9;

export function NewsView({ page, locale }: { page: Page; locale: string }) {
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("__all__");
  const [sort, setSort] = useState<string>("latest");
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // News is a singleton root, so every `article` page belongs to it — but we
    // still scope to this page's id so the view stays correct if that changes.
    getAllPages("article", locale)
      .then((pages) => {
        if (cancelled) return;
        const mine = pages.filter((p) => p.parentId === page.id).map((p) => toArticle(p, locale));
        setArticles(mine);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page.id, locale]);

  // Distinct article types present in the content drive the filter chips.
  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) if (a.type) set.add(a.type);
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [articles]);

  const visible = useMemo(() => {
    const filtered = filter === "__all__" ? articles : articles.filter((a) => a.type === filter);
    const sorted = [...filtered].sort((a, b) =>
      sort === "latest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
    return sorted;
  }, [articles, filter, sort]);

  // Reset to the first page whenever the filter/sort changes.
  useEffect(() => setPageNo(1), [filter, sort]);

  const featured = sort === "latest" && filter === "__all__" ? visible[0] : undefined;
  const listSource = featured ? visible.slice(1) : visible;
  const totalPages = Math.max(1, Math.ceil(listSource.length / PAGE_SIZE));
  const pageItems = listSource.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE);

  const articleHref = (slug: string) => `/${locale}/${page.slug}/${slug}`;

  return (
    <Container size="lg" py={48}>
      {/* Header — the news page title (news has no body content of its own). */}
      <Title order={1} mb="xl">{page.title}</Title>

      {loading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : articles.length === 0 ? (
        <Text c="dimmed">{L.empty}</Text>
      ) : (
        <Stack gap="xl">
          {/* Featured (latest) article */}
          {featured && (
            <Card withBorder padding="lg" radius="md">
              <Group align="stretch" wrap="nowrap" gap="lg">
                <Box style={{ flex: "0 0 45%", minWidth: 0 }}>
                  <AspectRatio ratio={16 / 10}>
                    {featured.heroImage ? (
                      <Image src={featured.heroImage} alt={featured.title} radius="sm" fit="cover" />
                    ) : (
                      <Box bg="gray.1" style={{ borderRadius: 8 }} />
                    )}
                  </AspectRatio>
                </Box>
                <Stack gap="sm" style={{ flex: 1, minWidth: 0 }} justify="center">
                  <Group gap="xs">
                    <Badge color="green" variant="light">{L.featured}</Badge>
                    {featured.type && <Badge variant="light">{featured.type}</Badge>}
                    <Text size="sm" c="dimmed">{formatDate(featured.date, locale)}</Text>
                  </Group>
                  <Title order={2}>{featured.title}</Title>
                  {featured.excerpt && <Text c="dimmed" lineClamp={3}>{featured.excerpt}</Text>}
                  <Box>
                    <Button component={Link} to={articleHref(featured.slug)} variant="filled" color="dark">
                      {L.read}
                    </Button>
                  </Box>
                </Stack>
              </Group>
            </Card>
          )}

          {/* Filter + sort bar */}
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Button
                size="xs"
                variant={filter === "__all__" ? "filled" : "default"}
                color="green"
                onClick={() => setFilter("__all__")}
              >
                {L.all}
              </Button>
              {types.map((t) => (
                <Button
                  key={t}
                  size="xs"
                  variant={filter === t ? "filled" : "default"}
                  color="green"
                  onClick={() => setFilter(t)}
                >
                  {t}
                </Button>
              ))}
            </Group>
            <Select
              size="xs"
              w={180}
              label={undefined}
              aria-label={L.sortLabel}
              value={sort}
              onChange={(v) => setSort(v ?? "latest")}
              data={[
                { value: "latest", label: L.latest },
                { value: "oldest", label: L.oldest },
              ]}
            />
          </Group>

          <Divider />

          {/* Article grid */}
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {pageItems.map((a) => (
              <Card key={a.id} withBorder padding="md" radius="md" component={Link} to={articleHref(a.slug)}>
                <Card.Section>
                  <AspectRatio ratio={16 / 10}>
                    {a.cardImage ? (
                      <Image src={a.cardImage} alt={a.title} fit="cover" />
                    ) : (
                      <Box bg="gray.1" />
                    )}
                  </AspectRatio>
                </Card.Section>
                <Group justify="space-between" mt="sm" mb={4}>
                  {a.type ? <Badge variant="light" size="sm">{a.type}</Badge> : <span />}
                  <Text size="xs" c="dimmed">{formatDate(a.date, locale)}</Text>
                </Group>
                <Text fw={600} lineClamp={2}>{a.title}</Text>
                {a.excerpt && (
                  <Text size="sm" c="dimmed" mt={4} lineClamp={3}>{a.excerpt}</Text>
                )}
                <Anchor component="span" size="sm" c="green" mt="sm" fw={600}>
                  {L.read} →
                </Anchor>
              </Card>
            ))}
          </SimpleGrid>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination total={totalPages} value={pageNo} onChange={setPageNo} color="green" />
            </Group>
          )}
        </Stack>
      )}
    </Container>
  );
}
