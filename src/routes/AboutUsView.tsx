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
  Image,
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
import { useLocaleConfig, useStrings } from "@/lib/locale";

// ─── about-us block data ──────────────────────────────────────────────────────

interface AboutUsData {
  altTitle: string;
  heroImage: { cdnUrl?: string } | null;
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
    heroImage: (d.heroImage as { cdnUrl?: string }) ?? null,
    subtitle: d.subtitle ?? "",
    description: d.description ?? "",
    btn1Link: (d.btn1Link as Record<string, unknown>) ?? null,
    btn2Link: (d.btn2Link as Record<string, unknown>) ?? null,
    section2Title: d.section2Title ?? "",
    section3Title: d.section3Title ?? "",
    section3Subtitle: d.section3Subtitle ?? "",
  };
}

// Smooth-scroll a same-page anchor (#id) into view.
function scrollToAnchor(hash: string) {
  const id = hash.replace(/^#/, "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Settings stores either a bare URL or the full Google Maps "Embed a map"
// <iframe …> snippet. Pull the embeddable URL out of the snippet; pass a bare
// URL through unchanged. (Putting the whole <iframe> string into an iframe's
// src is what made the modal load our own site.)
export function extractMapEmbedSrc(value: string): string {
  const m = value.match(/src\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : value.trim();
}

// A maps link the native app can deep-link to. Prefer a place search built from
// the address (reliable on iOS/Android); fall back to the embed src.
export function mapsAppLink(address: string, embedSrc: string): string {
  if (address.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return embedSrc;
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
  // Same-page anchor (e.g. a "remote URL" of "#kontakt") → smooth-scroll instead
  // of navigating. Lets a CTA like "Kontaktiraj nas" focus section 3.
  if (resolved.href.startsWith("#")) {
    return (
      <UnstyledButton onClick={() => scrollToAnchor(resolved.href)} title={tooltip}>
        {btn}
      </UnstyledButton>
    );
  }
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
  const { t } = useStrings();
  const [mapOpen, setMapOpen] = useState(false);
  if (!contact) return null;

  const Phone = icons.Phone;
  const Mail = icons.Mail;
  const Pin = icons.MapPin;

  const hasMaps = Boolean(contact.mapsUrl && contact.mapsUrl.trim());
  const embedSrc = extractMapEmbedSrc(contact.mapsUrl);
  const appLink = mapsAppLink(contact.address, embedSrc);

  function onMapClick() {
    if (!hasMaps) return;
    // On phones/tablets, open a place link directly so the OS hands it to the
    // native Google Maps / Apple Maps app. On desktop, show the embed modal.
    if (IS_MOBILE) {
      window.open(appLink, "_blank", "noopener,noreferrer");
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
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">{t("about.contact_phone")}</Text>
              <Text fz="sm" component="a" href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} style={{ color: "inherit" }}>
                {contact.phone}
              </Text>
            </div>
          </Group>
        )}
        {contact.email && (
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="teal.6" mt={2}><Mail size={18} /></Box>
            <div>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">{t("about.contact_email")}</Text>
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
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">{t("about.contact_fax")}</Text>
              <Text fz="sm" component="a" href={`tel:${contact.fax.replace(/[^+\d]/g, "")}`} style={{ color: "inherit" }}>
                {contact.fax}
              </Text>
            </div>
          </Group>
        )}
        {contact.address && (
          <Group gap="sm" align="flex-start" wrap="nowrap">
            <Box c="teal.6" mt={2}><Pin size={18} /></Box>
            <div>
              <Text fz="xs" fw={700} c="dimmed" tt="uppercase">{t("about.contact_address")}</Text>
              <Text fz="sm">{contact.address}</Text>
            </div>
          </Group>
        )}
      </SimpleGrid>

      <UnstyledButton
        onClick={onMapClick}
        disabled={!hasMaps}
        style={{ display: "block", cursor: hasMaps ? "pointer" : "default", borderRadius: 8, overflow: "hidden" }}
        aria-label={t("about.map_title")}
      >
        <Image src="/map.svg" alt={t("about.map_title")} radius="md" />
      </UnstyledButton>

      <Modal opened={mapOpen} onClose={() => setMapOpen(false)} title={t("about.map_title")} size="xl" centered>
        <Stack gap="md">
          <AspectRatio ratio={16 / 9}>
            <iframe
              title="Google Maps"
              src={embedSrc}
              style={{ border: 0, width: "100%", height: "100%", borderRadius: 8 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </AspectRatio>
          <Group justify="flex-end">
            <Button
              component="a"
              href={appLink}
              target="_blank"
              rel="noopener noreferrer"
              variant="light"
              color="teal"
            >
              {t("about.map_open")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ─── Static contact form (UI only) ────────────────────────────────────────────

function InquiryForm() {
  const { t } = useStrings();
  const serviceOptions = [
    t("about.form_service_opt1"),
    t("about.form_service_opt2"),
    t("about.form_service_opt3"),
    t("about.form_service_opt4"),
    t("about.form_service_opt5"),
    t("about.form_service_opt6"),
  ];
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Stack gap="md">
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label={t("about.form_fullname")} placeholder={t("about.form_fullname_ph")} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label={t("about.form_email")} type="email" placeholder={t("about.form_email_ph")} />
          </Grid.Col>
        </Grid>
        <Select
          label={t("about.form_service")}
          placeholder={t("about.form_service_ph")}
          data={serviceOptions}
        />
        <Textarea label={t("about.form_message")} placeholder={t("about.form_message_ph")} autosize minRows={4} />
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
          {t("about.form_dropzone")}
        </Box>
        <Button type="submit" color="teal" size="md" fullWidth>
          {t("about.form_submit")}
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
              {d.heroImage?.cdnUrl ? (
                <Image src={d.heroImage.cdnUrl} alt={d.altTitle} radius="md" fit="cover" />
              ) : (
                <Box bg="gray.2" style={{ borderRadius: 8 }} />
              )}
            </AspectRatio>
          </Grid.Col>
        </Grid>

        {/* ── Section 2: title → description → featured banners ─────────── */}
        <Stack gap="xl">
          <Stack gap="md">
            {d.section2Title && <SectionTitle>{d.section2Title}</SectionTitle>}
            {d.description && <Text c="dimmed">{d.description}</Text>}
          </Stack>
          <FeaturedBanners banners={banners} locale={locale} defaultLocale={defaultLocale} />
        </Stack>

        {/* ── Section 3: title + subtitle + form / contact ──────────────── */}
        <Grid id="kontakt" gutter={{ base: 40, md: 64 }} style={{ scrollMarginTop: 80 }}>
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
