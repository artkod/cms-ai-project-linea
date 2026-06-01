import { useMemo, useState } from "react";
import { Box, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import {
  Button,
  IconPicker,
  LinkPickerModal,
  computeLinkHref,
  type BlockEditorProps,
  type BlockTypeDefinition,
  type LinkData,
} from "@cms/admin-base";

// ─── Data model ──────────────────────────────────────────────────────────────
//
// about-us is a singleton-block page type: the page allows exactly one block of
// type "about-us", auto-seeded on create. All of the "O nama" page content is
// authored here — an icon, subtitle + description, and two buttons (label text +
// link target). Mirrors the ProductItemBlock pattern so the editor card looks
// and behaves consistently across page types.

interface AboutUsData {
  icon: string | null;
  subtitle: string;
  description: string;
  btn1Text: string;
  btn1Link: LinkData | null;
  btn2Text: string;
  btn2Link: LinkData | null;
}

const DEFAULT_DATA: AboutUsData = {
  icon: null,
  subtitle: "",
  description: "",
  btn1Text: "",
  btn1Link: null,
  btn2Text: "",
  btn2Link: null,
};

function isLinkData(v: unknown): v is LinkData {
  return typeof v === "object" && v !== null && "linkType" in v;
}

// Coerce arbitrary stored data (including partial / legacy shapes) into the full
// AboutUsData shape so the editor doesn't crash on first render.
function normalize(raw: Record<string, unknown>): AboutUsData {
  const r = raw as Partial<AboutUsData>;
  return {
    icon: typeof r.icon === "string" ? r.icon : null,
    subtitle: typeof r.subtitle === "string" ? r.subtitle : "",
    description: typeof r.description === "string" ? r.description : "",
    btn1Text: typeof r.btn1Text === "string" ? r.btn1Text : "",
    btn1Link: isLinkData(r.btn1Link) ? r.btn1Link : null,
    btn2Text: typeof r.btn2Text === "string" ? r.btn2Text : "",
    btn2Link: isLinkData(r.btn2Link) ? r.btn2Link : null,
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
            <Text size="sm">{linkSummary(value)}</Text>
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
  text,
  link,
  onTextChange,
  onLinkChange,
}: {
  title: string;
  text: string;
  link: LinkData | null;
  onTextChange: (v: string) => void;
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
        <TextInput
          label="Tekst gumba"
          placeholder="npr. Saznaj više"
          value={text}
          onChange={(e) => onTextChange(e.currentTarget.value)}
        />
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
        <IconPicker
          label="Ikona"
          value={d.icon}
          onChange={(v) => patch({ icon: v })}
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
        <SectionHeader title="Gumbi" />
        <ButtonGroup
          title="Gumb 1"
          text={d.btn1Text}
          link={d.btn1Link}
          onTextChange={(v) => patch({ btn1Text: v })}
          onLinkChange={(v) => patch({ btn1Link: v })}
        />
        <ButtonGroup
          title="Gumb 2"
          text={d.btn2Text}
          link={d.btn2Link}
          onTextChange={(v) => patch({ btn2Text: v })}
          onLinkChange={(v) => patch({ btn2Link: v })}
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
