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
  Grid,
  SimpleGrid,
  Card,
  Modal,
  TextInput,
  Textarea,
  Select,
  UnstyledButton,
  AspectRatio,
} from "@mantine/core";
import { icons } from "lucide-react";
import {
  type Page,
  type Block,
  type LinkPagesMap,
  type FeaturedBanner,
  type ContactInfo,
  getFeaturedBanners,
  getContactInfo,
} from "@/lib/api";
import { useLocaleConfig } from "@/lib/locale";

// ─── about-us block data ──────────────────────────────────────────────────────

interface AboutUsData {
  altTitle: string;
  subtitle: string;
  description: string;
  btn1Link: Record<string, unknown> | null;
  btn2Link: Record<string, unknown> | null;
  section2Title: string;
  section3Title: string;
  section3Subtitle: string;
}

function readBlock(page: Page): AboutUsData {
  const block = (page.blocks ?? []).find((b: Block) => b.type === "about-us");
  const d = (block?.data ?? {}) as Partial<AboutUsData>;
  return {
    altTitle: d.altTitle ?? "",
    subtitle: d.subtitle ?? "",
    description: d.description ?? "",
    btn1Link: (d.btn1Link as Record<string, unknown>) ?? null,
    btn2Link: (d.btn2Link as Record<string, unknown>) ?? null,
    section2Title: d.section2Title ?? "",
    section3Title: d.section3Title ?? "",
    section3Subtitle: d.section3Subtitle ?? "",
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// Resolve a CMS LinkData object → a navigable href (mirrors PageView's
// LinkRenderer, but standalone since this view lives in its own file).
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

// Pick the active-locale value out of a { [locale]: string } map, falling back
// to the default locale, then to any non-empty value.
function pickLocalized(map: Record<string, string> | undefined, locale: string, defaultLocale: string): string {
  if (!map) return "";
  return map[locale] || map[defaultLocale] || Object.values(map).find((v) => v && v.trim()) || "";
}

function CmsButton({
  link,
  label: fallbackLabel,
  variant,
  locale,
  linkPages,
}: {
  link: Record<string, unknown> | null;
  label?: string;
  variant: "filled" | "outline";
  locale: string;
  linkPages: LinkPagesMap;
}) {
  const resolved = resolveHref(link, locale, linkPages);
  if (!resolved) return null;
  const label = (link?.linkText as string) || fallbackLabel || resolved.href;
  const tooltip = (link?.tooltip as string) || undefined;
  const btn = (
    <Button variant={variant} color="teal" size="md">
      {label}
    </Button>
  );
  if (resolved.internal && !resolved.newTab) {
    return (
      <Link to={resolved.href} style={{ textDecoration: "none" }} title={tooltip}>
        {btn}
      </Link>
    );
  }
  return (
    <a
      href={resolved.href}
      title={tooltip}
      target={resolved.newTab ? "_blank" : undefined}
      rel={resolved.newTab ? "noopener noreferrer" : undefined}
      style={{ textDecoration: "none" }}
    >
      {btn}
    </a>
  );
}

// Heading with the small teal accent bar used under section titles.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Box>
      <Title order={2} mb={8}>
        {children}
      </Title>
      <Box w={56} h={3} bg="teal.6" style={{ borderRadius: 2 }} />
    </Box>
  );
}

const IS_MOBILE =
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ─── Featured banners ─────────────────────────────────────────────────────────

function FeaturedBanners({ banners, locale, defaultLocale }: { banners: FeaturedBanner[]; locale: string; defaultLocale: string }) {
  if (!banners.length) return null;
  return (
    <SimpleGrid cols={{ base: 1, sm: banners.length >= 3 ? 3 : banners.length }} spacing="lg">
      {banners.map((b, i) => {
        const Icon = b.icon ? (icons as Record<string, typeof icons.Truck>)[b.icon] : null;
        const title = pickLocalized(b.title, locale, defaultLocale);
        const content = pickLocalized(b.content, locale, defaultLocale);
        return (
          <Card key={i} withBorder padding="lg" radius="md">
            <Stack gap="sm">
              {Icon && (
                <Box
                  w={40}
                  h={40}
                  bg="teal.5"
                  c="white"
                  style={{ borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Icon size={20} />
                </Box>
              )}
              {title && (
                <Text fw={600} fz="lg">
                  {title}
                </Text>
              )}
              {content && (
                <Text c="dimmed" fz="sm">
                  {content}
                </Text>
              )}
            </Stack>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}

// ─── Contact panel (info + map) ───────────────────────────────────────────────

function ContactPanel({ contact }: { contact: ContactInfo | null }) {
  const [mapOpen, setMapOpen] = useState(false);
  if (!contact) return null;

  const Phone = icons.Phone;
  const Mail = icons.Mail;
  const Pin = icons.MapPin;

  const hasMaps = Boolean(contact.mapsUrl && contact.mapsUrl.trim());

  function onMapClick() {
    if (!hasMaps) return;
    // On phones/tablets, open the link directly so the OS hands it to the
    // native Google Maps / Apple Maps app. On desktop, show the embed modal.
    if (IS_MOBILE) {
      window.open(contact!.mapsUrl, "_blank", "noopener,noreferrer");
    } else {
      setMapOpen(true);
    }
  }

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
        {contact.phone && (
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="teal.6" mt={2}><Phone size={18} /></Box>
            <div>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">Phone</Text>
              <Text fz="sm">{contact.phone}</Text>
            </div>
          </Group>
        )}
        {contact.email && (
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="teal.6" mt={2}><Mail size={18} /></Box>
            <div>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">Email</Text>
              <Text fz="sm" component="a" href={`mailto:${contact.email}`} style={{ color: "inherit" }}>
                {contact.email}
              </Text>
            </div>
          </Group>
        )}
        {contact.fax && (
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="teal.6" mt={2}><Phone size={18} /></Box>
            <div>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">Fax</Text>
              <Text fz="sm">{contact.fax}</Text>
            </div>
          </Group>
        )}
        {contact.address && (
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="teal.6" mt={2}><Pin size={18} /></Box>
            <div>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">Address</Text>
              <Text fz="sm">{contact.address}</Text>
            </div>
          </Group>
        )}
      </SimpleGrid>

      <UnstyledButton
        onClick={onMapClick}
        disabled={!hasMaps}
        style={{ display: "block", cursor: hasMaps ? "pointer" : "default", borderRadius: 8, overflow: "hidden" }}
        aria-label="Open map"
      >
        <Box
          style={{
            backgroundImage: "url(/map.svg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            width: "100%",
            height: 260,
            borderRadius: 8,
          }}
        />
      </UnstyledButton>

      <Modal opened={mapOpen} onClose={() => setMapOpen(false)} title="Location" size="xl" centered>
        <Stack gap="md">
          <AspectRatio ratio={16 / 9}>
            <iframe
              title="Google Maps"
              src={contact.mapsUrl}
              style={{ border: 0, width: "100%", height: "100%", borderRadius: 8 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </AspectRatio>
          <Group justify="flex-end">
            <Button
              component="a"
              href={contact.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              color="teal"
            >
              Open in Google Maps
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ─── Static contact form (UI only) ────────────────────────────────────────────

function InquiryForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Stack gap="md">
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Full name" placeholder="John Doe" />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Email address" type="email" placeholder="john@company.com" />
          </Grid.Col>
        </Grid>
        <Select
          label="Service type"
          placeholder="Select a service…"
          data={["Banners", "Signage", "Large Format", "Displays", "Stationery", "Custom"]}
        />
        <Textarea label="Message" placeholder="Describe your project requirements…" autosize minRows={4} />
        <Box
          p="md"
          style={{
            border: "1px dashed var(--mantine-color-gray-4)",
            borderRadius: 8,
            textAlign: "center",
            color: "var(--mantine-color-dimmed)",
            fontSize: 14,
          }}
        >
          Drag &amp; drop technical specs or print-ready files here (Max 50MB)
        </Box>
        <Button type="submit" color="teal" size="md" fullWidth>
          Submit inquiry
        </Button>
      </Stack>
    </form>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AboutUsView({ page, locale }: { page: Page; locale: string }) {
  const d = useMemo(() => readBlock(page), [page]);
  const { defaultLocale } = useLocaleConfig();
  const linkPages = page.linkPages ?? {};

  const [banners, setBanners] = useState<FeaturedBanner[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getFeaturedBanners().then((b) => !cancelled && setBanners(b));
    void getContactInfo().then((c) => !cancelled && setContact(c));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container size="lg" py={48}>
      <Stack gap={72}>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <Grid gutter={{ base: 32, md: 48 }} align="center">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              {d.altTitle && <Title order={1} fz={{ base: 32, md: 44 }} lh={1.1}>{d.altTitle}</Title>}
              {d.subtitle && <Text c="dimmed" fz="lg">{d.subtitle}</Text>}
              {(d.btn1Link || d.btn2Link) && (
                <Group gap="md" mt="sm">
                  <CmsButton link={d.btn1Link} variant="filled" locale={locale} linkPages={linkPages} />
                  <CmsButton link={d.btn2Link} variant="outline" locale={locale} linkPages={linkPages} />
                </Group>
              )}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <AspectRatio ratio={4 / 3}>
              <Box bg="gray.2" style={{ borderRadius: 8 }} />
            </AspectRatio>
          </Grid.Col>
        </Grid>

        {/* ── Section 2: title + description + featured banners ─────────── */}
        <Stack gap="xl">
          <Grid gutter={{ base: 24, md: 48 }} align="flex-end">
            <Grid.Col span={{ base: 12, md: 5 }}>
              {d.section2Title && <SectionTitle>{d.section2Title}</SectionTitle>}
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              {d.description && <Text c="dimmed">{d.description}</Text>}
            </Grid.Col>
          </Grid>
          <FeaturedBanners banners={banners} locale={locale} defaultLocale={defaultLocale} />
        </Stack>

        {/* ── Section 3: title + subtitle + form / contact ──────────────── */}
        <Grid gutter={{ base: 40, md: 64 }}>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              {d.section3Title && <Title order={2}>{d.section3Title}</Title>}
              {d.section3Subtitle && <Text c="dimmed">{d.section3Subtitle}</Text>}
              <InquiryForm />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <ContactPanel contact={contact} />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
