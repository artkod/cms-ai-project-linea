import { useMemo, useState } from "react";
import { Box, Group, Image, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { Upload } from "lucide-react";
import {
  Button,
  ImagePickerModal,
  LinkPickerModal,
  computeLinkHref,
  type BlockEditorProps,
  type BlockTypeDefinition,
  type GalleryImage,
  type LinkData,
} from "@cms/admin-base";

// ─── Data model ──────────────────────────────────────────────────────────────
//
// about-us is a singleton-block page type: the page allows exactly one block of
// type "about-us", auto-seeded on create. All of the "O nama" page content is
// authored here — subtitle + description, and two buttons. Each button is a
// single LinkData object: the link picker now captures the button label
// ("Link text") + tooltip alongside the target, so there's no separate text
// field. Mirrors the ProductItemBlock pattern so the editor card looks and
// behaves consistently across page types.

interface AboutUsData {
  altTitle: string;
  heroImage: GalleryImage | null;
  subtitle: string;
  description: string;
  btn1Link: LinkData | null;
  btn2Link: LinkData | null;
  section2Title: string;
  section3Title: string;
  section3Subtitle: string;
}

const DEFAULT_DATA: AboutUsData = {
  altTitle: "",
  heroImage: null,
  subtitle: "",
  description: "",
  btn1Link: null,
  btn2Link: null,
  section2Title: "",
  section3Title: "",
  section3Subtitle: "",
};

function isGalleryImage(v: unknown): v is GalleryImage {
  return typeof v === "object" && v !== null && "cdnUrl" in v;
}

function isLinkData(v: unknown): v is LinkData {
  return typeof v === "object" && v !== null && "linkType" in v;
}

// Fold a legacy standalone button-text field into the link's `linkText` so
// pages authored before the picker captured the label keep their button copy.
function migrateLink(link: unknown, legacyText: unknown): LinkData | null {
  if (!isLinkData(link)) return null;
  if (
    (!link.linkText || link.linkText.trim() === "") &&
    typeof legacyText === "string" &&
    legacyText.trim() !== ""
  ) {
    return { ...link, linkText: legacyText };
  }
  return link;
}

// Coerce arbitrary stored data (including partial / legacy shapes) into the full
// AboutUsData shape so the editor doesn't crash on first render.
function normalize(raw: Record<string, unknown>): AboutUsData {
  const r = raw as Partial<AboutUsData> & { btn1Text?: unknown; btn2Text?: unknown };
  return {
    altTitle: typeof r.altTitle === "string" ? r.altTitle : "",
    heroImage: isGalleryImage(r.heroImage) ? r.heroImage : null,
    subtitle: typeof r.subtitle === "string" ? r.subtitle : "",
    description: typeof r.description === "string" ? r.description : "",
    btn1Link: migrateLink(r.btn1Link, r.btn1Text),
    btn2Link: migrateLink(r.btn2Link, r.btn2Text),
    section2Title: typeof r.section2Title === "string" ? r.section2Title : "",
    section3Title: typeof r.section3Title === "string" ? r.section3Title : "",
    section3Subtitle: typeof r.section3Subtitle === "string" ? r.section3Subtitle : "",
  };
}

// ─── Section header (visual divider inside the block body) ───────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      size="sm"
      fw={700}
      style={{
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--cms-ink-3, #6c7686)",
      }}
    >
      {title}
    </Text>
  );
}

// ─── Single-image picker ─────────────────────────────────────────────────────

function ImageField({
  label,
  modalTitle,
  value,
  onChange,
}: {
  label: string;
  modalTitle: string;
  value: GalleryImage | null;
  onChange: (v: GalleryImage | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stack gap={6}>
        <Text size="sm" fw={500}>{label}</Text>
        {value ? (
          <Group align="flex-start" gap={12}>
            <Image src={value.cdnUrl} w={160} h={120} fit="cover" radius="sm" alt={label} />
            <Stack gap={6}>
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                Promijeni
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
                Ukloni
              </Button>
            </Stack>
          </Group>
        ) : (
          <Button variant="secondary" size="sm" leftSection={<Upload size={14} />} onClick={() => setOpen(true)}>
            Odaberi sliku
          </Button>
        )}
      </Stack>
      <ImagePickerModal
        opened={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        mode="single"
        onConfirm={(imgs) => {
          if (imgs[0]) onChange(imgs[0]);
          setOpen(false);
        }}
      />
    </>
  );
}

// ─── Link field (label + picker) ─────────────────────────────────────────────

function linkSummary(d: LinkData): string {
  switch (d.linkType) {
    case "page":
      return d.pageTitle ? `Stranica: ${d.pageTitle}` : "Stranica";
    case "remote":
      return d.url || "URL";
    case "email":
      return d.email ? `E-mail: ${d.email}` : "E-mail";
    default:
      return "Poveznica";
  }
}

function LinkField({
  value,
  onChange,
}: {
  value: LinkData | null;
  onChange: (v: LinkData | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const href = value ? computeLinkHref(value) : null;
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>Poveznica</Text>
      {value ? (
        <Group gap={8} align="center" wrap="nowrap">
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm">{value.linkText?.trim() || linkSummary(value)}</Text>
            {href && (
              <Text size="xs" c="dimmed" truncate style={{ maxWidth: 360 }}>
                {href}
              </Text>
            )}
          </Stack>
          <Button variant="secondary" size="xs" onClick={() => setOpen(true)}>
            Promijeni
          </Button>
          <Button variant="danger-ghost" size="xs" onClick={() => onChange(null)}>
            Ukloni
          </Button>
        </Group>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Postavi poveznicu
        </Button>
      )}
      <LinkPickerModal
        mode="rte"
        showTextFields
        opened={open}
        onClose={() => setOpen(false)}
        initialData={value ?? undefined}
        onConfirm={(d) => {
          onChange(d);
          setOpen(false);
        }}
      />
    </Stack>
  );
}

// ─── Button group (text + link) ──────────────────────────────────────────────

function ButtonGroup({
  title,
  link,
  onLinkChange,
}: {
  title: string;
  link: LinkData | null;
  onLinkChange: (v: LinkData | null) => void;
}) {
  return (
    <Box
      style={{
        border: "1px solid var(--mantine-color-gray-3, #dee2e6)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <Stack gap={10}>
        <Text size="sm" fw={600}>{title}</Text>
        <LinkField value={link} onChange={onLinkChange} />
      </Stack>
    </Box>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function AboutUsEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);

  function patch(p: Partial<AboutUsData>) {
    onChange({ ...d, ...p } as unknown as Record<string, unknown>);
  }

  return (
    <Stack gap={20}>
      <Stack gap={10}>
        <SectionHeader title="Osnovni podaci" />
        <TextInput
          label="Alternativni naslov"
          placeholder="Alternativni naslov"
          value={d.altTitle}
          onChange={(e) => patch({ altTitle: e.currentTarget.value })}
        />
        <ImageField
          label="Hero slika"
          modalTitle="Odaberi hero sliku"
          value={d.heroImage}
          onChange={(v) => patch({ heroImage: v })}
        />
        <Textarea
          label="Podnaslov"
          placeholder="Podnaslov"
          value={d.subtitle}
          onChange={(e) => patch({ subtitle: e.currentTarget.value })}
          autosize
          minRows={2}
          maxRows={6}
        />
      </Stack>

      <Stack gap={10}>
        <SectionHeader title="Gumbi" />
        <ButtonGroup
          title="Gumb 1"
          link={d.btn1Link}
          onLinkChange={(v) => patch({ btn1Link: v })}
        />
        <ButtonGroup
          title="Gumb 2"
          link={d.btn2Link}
          onLinkChange={(v) => patch({ btn2Link: v })}
        />
      </Stack>

      <Stack gap={10}>
        <SectionHeader title="Sekcija 2" />
        <TextInput
          label="Naslov sekcije 2"
          placeholder="Naslov sekcije 2"
          value={d.section2Title}
          onChange={(e) => patch({ section2Title: e.currentTarget.value })}
        />
        <Textarea
          label="Opis"
          placeholder="Opis"
          value={d.description}
          onChange={(e) => patch({ description: e.currentTarget.value })}
          autosize
          minRows={3}
          maxRows={10}
        />
      </Stack>

      <Stack gap={10}>
        <SectionHeader title="Sekcija 3" />
        <TextInput
          label="Naslov sekcije 3"
          placeholder="Naslov sekcije 3"
          value={d.section3Title}
          onChange={(e) => patch({ section3Title: e.currentTarget.value })}
        />
        <Textarea
          label="Podnaslov sekcije 3"
          placeholder="Podnaslov sekcije 3"
          value={d.section3Subtitle}
          onChange={(e) => patch({ section3Subtitle: e.currentTarget.value })}
          autosize
          minRows={2}
          maxRows={6}
        />
      </Stack>
    </Stack>
  );
}

export const aboutUsBlock: BlockTypeDefinition = {
  type: "about-us",
  label: "About us",
  defaultData: DEFAULT_DATA as unknown as Record<string, unknown>,
  EditorComponent: AboutUsEditor,
  getLabel: (data) => {
    const d = normalize(data);
    return d.subtitle?.trim() || "O nama";
  },
};
