import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Container,
  Title,
  Text,
  Box,
  Group,
  Stack,
  SimpleGrid,
  Card,
  Image,
  AspectRatio,
  Loader,
  Pagination,
  Anchor,
} from "@mantine/core";
import { getAllPages, type Page } from "@/lib/api";

// ─── EU-project model (derived from child `eu-project-item` pages) ─────────────
//
// Each entry is a published `eu-project-item` page whose parent is this
// eu-projects page. Its card image is the project's main photo; the short
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
    image: imgUrl(td.mainPhoto),
    excerpt: p.translations?.[locale]?.metaDescription ?? "",
  };
}

const LABELS = {
  en: { read: "View project", empty: "No projects yet." },
  hr: { read: "Pogledaj projekt", empty: "Još nema projekata." },
} as const;

const PAGE_SIZE = 9;

export function EuProjectsView({ page, locale }: { page: Page; locale: string }) {
  const L = LABELS[locale as keyof typeof LABELS] ?? LABELS.en;
  const [items, setItems] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // eu-projects is a singleton root, so every `eu-project-item` belongs to it —
    // but we still scope to this page's id so the view stays correct if that changes.
    getAllPages("eu-project-item", locale)
      .then((pages) => {
        if (cancelled) return;
        const mine = pages.filter((p) => p.parentId === page.id).map((p) => toCard(p, locale));
        setItems(mine);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page.id, locale]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((pageNo - 1) * PAGE_SIZE, pageNo * PAGE_SIZE);

  const itemHref = (slug: string) => `/${locale}/${page.slug}/${slug}`;

  return (
    <Container size="lg" py={48}>
      <Title order={1} mb="xl">{page.title}</Title>

      {loading ? (
        <Group justify="center" py="xl"><Loader /></Group>
      ) : items.length === 0 ? (
        <Text c="dimmed">{L.empty}</Text>
      ) : (
        <Stack gap="xl">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {pageItems.map((it) => (
              <Card key={it.id} withBorder padding="md" radius="md" component={Link} to={itemHref(it.slug)}>
                <Card.Section>
                  <AspectRatio ratio={16 / 10}>
                    {it.image ? (
                      <Image src={it.image} alt={it.title} fit="cover" />
                    ) : (
                      <Box bg="gray.1" />
                    )}
                  </AspectRatio>
                </Card.Section>
                <Text fw={600} mt="sm" lineClamp={2}>{it.title}</Text>
                {it.excerpt && (
                  <Text size="sm" c="dimmed" mt={4} lineClamp={3}>{it.excerpt}</Text>
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
