import { useMemo } from "react";
import { Link } from "react-router";
import {
  Container,
  Title,
  Text,
  Box,
  Group,
  Stack,
  Button,
  Grid,
  SimpleGrid,
  Card,
  Image,
  AspectRatio,
  Divider,
} from "@mantine/core";
import { Download } from "lucide-react";
import { type Page, type Block, type LinkPagesMap } from "@/lib/api";
import { useStrings } from "@/lib/locale";

// ─── catalogues block data ──────────────────────────────────────────────────

interface MediaRef {
  mediaId?: string;
  cdnUrl?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

interface CatalogueDoc {
  id: string;
  title: string;
  file: MediaRef | null;
}

interface CataloguesData {
  subtitle: string;
  documents: CatalogueDoc[];
  contactLink: Record<string, unknown> | null;
  coverImages: MediaRef[];
}

function readBlock(page: Page): CataloguesData {
  const block = (page.blocks ?? []).find((b: Block) => b.type === "catalogues");
  const d = (block?.data ?? {}) as Partial<CataloguesData>;
  return {
    subtitle: d.subtitle ?? "",
    documents: Array.isArray(d.documents) ? (d.documents as CatalogueDoc[]) : [],
    contactLink: (d.contactLink as Record<string, unknown>) ?? null,
    coverImages: Array.isArray(d.coverImages) ? (d.coverImages as MediaRef[]) : [],
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// Resolve a CMS LinkData object → a navigable href (mirrors AboutUsView).
function resolveHref(
  link: Record<string, unknown> | null,
  locale: string,
  linkPages: LinkPagesMap
): { href: string; internal: boolean; newTab: boolean } | null {
  if (!link) return null;
  const linkType = link.linkType as string;
  if (!linkType) return null;
  const newTab = Boolean(link.openInNewTab);

  if (linkType === "page") {
    const pageId = (link.pageId as string) || "";
    const resolved = pageId ? linkPages[pageId]?.[locale] : null;
    const path = resolved?.path && resolved.path.length ? resolved.path.join("/") : resolved?.slug;
    const href = resolved?.active && path ? `/${locale}/${path}` : `/${locale}/`;
    return { href, internal: true, newTab };
  }
  if (linkType === "remote") return { href: (link.url as string) || "#", internal: false, newTab };
  if (linkType === "email") {
    const e = (link.email as string) || "";
    const s = (link.emailSubject as string) || "";
    return { href: `mailto:${e}${s ? `?subject=${encodeURIComponent(s)}` : ""}`, internal: false, newTab };
  }
  if (linkType === "file") return { href: (link.fileUrl as string) || "#", internal: false, newTab };
  return null;
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Short uppercase type label from the MIME type (or filename extension).
function typeLabel(file: MediaRef | null): string {
  if (!file) return "";
  if (file.mimeType === "application/pdf") return "PDF";
  const fromName = file.name?.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromName) return fromName.toUpperCase();
  const sub = file.mimeType?.split("/")[1];
  return sub ? sub.toUpperCase() : "FILE";
}

function metaLine(file: MediaRef | null): string {
  const t = typeLabel(file);
  const s = formatSize(file?.size);
  return [t, s].filter(Boolean).join(" • ");
}

// ─── Contact CTA button ────────────────────────────────────────────────────

function ContactButton({
  link,
  label,
  locale,
  linkPages,
}: {
  link: Record<string, unknown> | null;
  label: string;
  locale: string;
  linkPages: LinkPagesMap;
}) {
  const resolved = resolveHref(link, locale, linkPages);
  const btn = (
    <Button color="dark" size="md">
      {label}
    </Button>
  );
  if (!resolved) {
    return <Button color="dark" size="md" disabled>{label}</Button>;
  }
  if (resolved.internal && !resolved.newTab) {
    return (
      <Link to={resolved.href} style={{ textDecoration: "none" }}>
        {btn}
      </Link>
    );
  }
  return (
    <a
      href={resolved.href}
      target={resolved.newTab ? "_blank" : undefined}
      rel={resolved.newTab ? "noopener noreferrer" : undefined}
      style={{ textDecoration: "none" }}
    >
      {btn}
    </a>
  );
}

// ─── Document card ────────────────────────────────────────────────────────────

function DownloadLink({ href, label }: { href: string | undefined; label: string }) {
  if (!href) return null;
  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      color="teal"
      variant="light"
      size="sm"
      leftSection={<Download size={16} />}
    >
      {label}
    </Button>
  );
}

function FeaturedCard({
  doc,
  cover,
  downloadLabel,
}: {
  doc: CatalogueDoc;
  cover: string | undefined;
  downloadLabel: string;
}) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Grid gutter="lg" align="center">
        <Grid.Col span={{ base: 12, sm: 5 }}>
          <AspectRatio ratio={4 / 3}>
            {cover ? (
              <Image src={cover} alt={doc.title} radius="sm" fit="cover" />
            ) : (
              <Box bg="gray.2" style={{ borderRadius: 8 }} />
            )}
          </AspectRatio>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 7 }}>
          <Stack gap="md">
            <Title order={2}>{doc.title || doc.file?.name}</Title>
            <Group justify="space-between" align="center">
              <Text c="dimmed" fz="sm">{metaLine(doc.file)}</Text>
              <DownloadLink href={doc.file?.cdnUrl} label={downloadLabel} />
            </Group>
          </Stack>
        </Grid.Col>
      </Grid>
    </Card>
  );
}

function DocumentCard({
  doc,
  cover,
  downloadLabel,
}: {
  doc: CatalogueDoc;
  cover: string | undefined;
  downloadLabel: string;
}) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Card.Section>
        <AspectRatio ratio={4 / 3}>
          {cover ? (
            <Image src={cover} alt={doc.title} fit="cover" />
          ) : (
            <Box bg="gray.2" />
          )}
        </AspectRatio>
      </Card.Section>
      <Stack gap="sm" mt="md">
        <Title order={4}>{doc.title || doc.file?.name}</Title>
        <Divider />
        <Group justify="space-between" align="center">
          <Text c="dimmed" fz="sm">{metaLine(doc.file)}</Text>
          <DownloadLink href={doc.file?.cdnUrl} label={downloadLabel} />
        </Group>
      </Stack>
    </Card>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function CataloguesView({ page, locale }: { page: Page; locale: string }) {
  const d = useMemo(() => readBlock(page), [page]);
  const { t } = useStrings();
  const linkPages = page.linkPages ?? {};

  // Cover photo for document i — rotate through the seeded placeholder pool.
  const coverFor = (i: number): string | undefined => {
    if (!d.coverImages.length) return undefined;
    return d.coverImages[i % d.coverImages.length]?.cdnUrl;
  };

  const [featured, ...rest] = d.documents;

  return (
    <Container size="lg" py={48}>
      <Stack gap={40}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Stack gap="md">
          <Title order={1} fz={{ base: 32, md: 44 }} lh={1.1}>{page.title}</Title>
          {d.subtitle && (
            <Text c="dimmed" fz="lg" maw={620}>{d.subtitle}</Text>
          )}
        </Stack>

        {/* ── Documents ──────────────────────────────────────────────────── */}
        {d.documents.length === 0 ? (
          <Text c="dimmed">{t("catalogues.empty")}</Text>
        ) : (
          <Stack gap="lg">
            {featured && (
              <FeaturedCard doc={featured} cover={coverFor(0)} downloadLabel={t("catalogues.download")} />
            )}
            {rest.length > 0 && (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                {rest.map((doc, i) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    cover={coverFor(i + 1)}
                    downloadLabel={t("catalogues.download")}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        )}

        {/* ── Contact CTA ────────────────────────────────────────────────── */}
        <Card radius="md" padding="xl" bg="gray.1">
          <Group justify="space-between" align="center" wrap="wrap" gap="lg">
            <Stack gap={6} style={{ flex: 1, minWidth: 260 }}>
              <Title order={3}>{t("catalogues.cta_heading")}</Title>
              <Text c="dimmed">{t("catalogues.cta_text")}</Text>
            </Stack>
            <ContactButton
              link={d.contactLink}
              label={t("catalogues.cta_button")}
              locale={locale}
              linkPages={linkPages}
            />
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}
