import { useMemo, useState } from "react";
import { Box, Group, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { FileText, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
// catalogues is a singleton-block page type (one block of type "catalogues",
// auto-seeded on create; Add/Remove hidden). It powers the public "Katalozi"
// resource-library page. The author writes an intro subtitle, attaches a list
// of downloadable documents (picked from the media library — PDFs etc.) and
// gives each a nicer display title, plus a "contact" CTA link target.
//
// `coverImages` is a pool of placeholder photos the frontend rotates through to
// give each document card a cover image — it is seeded once and round-tripped
// here (no editor UI, per design) so author saves never drop it.

interface CatalogueDoc {
  id: string;
  title: string;
  file: GalleryImage | null;
}

interface CataloguesData {
  subtitle: string;
  documents: CatalogueDoc[];
  contactLink: LinkData | null;
  coverImages: GalleryImage[];
}

const DEFAULT_DATA: CataloguesData = {
  subtitle: "",
  documents: [],
  contactLink: null,
  coverImages: [],
};

function isGalleryImage(v: unknown): v is GalleryImage {
  return typeof v === "object" && v !== null && "cdnUrl" in v;
}

function isLinkData(v: unknown): v is LinkData {
  return typeof v === "object" && v !== null && "linkType" in v;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `doc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }
}

// Strip the extension + tidy separators so a raw filename becomes a usable
// default display title (e.g. "katalog_2018_web.pdf" → "katalog 2018 web").
function titleFromFilename(name: string | undefined): string {
  if (!name) return "";
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function normalizeDoc(raw: unknown): CatalogueDoc {
  const r = (raw ?? {}) as Partial<CatalogueDoc>;
  return {
    id: typeof r.id === "string" && r.id ? r.id : newId(),
    title: typeof r.title === "string" ? r.title : "",
    file: isGalleryImage(r.file) ? r.file : null,
  };
}

// Coerce arbitrary stored data (including partial / legacy shapes) into the full
// CataloguesData shape so the editor doesn't crash on first render.
function normalize(raw: Record<string, unknown>): CataloguesData {
  const r = raw as Partial<CataloguesData>;
  return {
    subtitle: typeof r.subtitle === "string" ? r.subtitle : "",
    documents: Array.isArray(r.documents) ? r.documents.map(normalizeDoc) : [],
    contactLink: isLinkData(r.contactLink) ? r.contactLink : null,
    coverImages: Array.isArray(r.coverImages) ? r.coverImages.filter(isGalleryImage) : [],
  };
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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

// ─── Contact CTA link field ──────────────────────────────────────────────────

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

function ContactLinkField({
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
      <Text size="sm" fw={500}>Gumb za kontakt</Text>
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

// ─── Single document row (file picker + display title) ───────────────────────

function DocumentRow({
  doc,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  doc: CatalogueDoc;
  index: number;
  total: number;
  onChange: (d: CatalogueDoc) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      style={{
        border: "1px solid var(--mantine-color-gray-3, #dee2e6)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <Stack gap={10}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap={8} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <FileText size={18} style={{ flexShrink: 0, color: "var(--cms-ink-3, #6c7686)" }} />
            {doc.file ? (
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text size="sm" truncate style={{ maxWidth: 320 }}>{doc.file.name || "Dokument"}</Text>
                {formatSize(doc.file.size) && (
                  <Text size="xs" c="dimmed">{formatSize(doc.file.size)}</Text>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">Nije odabran dokument</Text>
            )}
          </Group>
          <Group gap={4} wrap="nowrap">
            <Button variant="secondary" size="xs" onClick={() => onMove(-1)} disabled={index === 0}>
              <ArrowUp size={14} />
            </Button>
            <Button variant="secondary" size="xs" onClick={() => onMove(1)} disabled={index === total - 1}>
              <ArrowDown size={14} />
            </Button>
            <Button variant="danger-ghost" size="xs" onClick={onRemove}>
              <Trash2 size={14} />
            </Button>
          </Group>
        </Group>

        <TextInput
          label="Naslov za prikaz"
          placeholder="npr. Katalog proizvoda 2024"
          value={doc.title}
          onChange={(e) => onChange({ ...doc, title: e.currentTarget.value })}
        />

        <Button variant="secondary" size="sm" leftSection={<FileText size={14} />} onClick={() => setOpen(true)}>
          {doc.file ? "Promijeni dokument" : "Odaberi dokument"}
        </Button>
      </Stack>

      <ImagePickerModal
        opened={open}
        onClose={() => setOpen(false)}
        title="Odaberi dokument"
        mode="single"
        fileType="document"
        onConfirm={(files) => {
          const f = files[0];
          if (f) onChange({ ...doc, file: f, title: doc.title || titleFromFilename(f.name) });
          setOpen(false);
        }}
      />
    </Box>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function CataloguesEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);

  function patch(p: Partial<CataloguesData>) {
    onChange({ ...d, ...p } as unknown as Record<string, unknown>);
  }

  function updateDoc(i: number, doc: CatalogueDoc) {
    patch({ documents: d.documents.map((x, idx) => (idx === i ? doc : x)) });
  }

  function addDoc() {
    patch({ documents: [...d.documents, { id: newId(), title: "", file: null }] });
  }

  function removeDoc(i: number) {
    patch({ documents: d.documents.filter((_, idx) => idx !== i) });
  }

  function moveDoc(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= d.documents.length) return;
    const next = [...d.documents];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ documents: next });
  }

  return (
    <Stack gap={20}>
      <Stack gap={10}>
        <SectionHeader title="Uvod" />
        <Textarea
          label="Podnaslov"
          placeholder="Kratki uvodni tekst (prikazuje se ispod naslova stranice)"
          value={d.subtitle}
          onChange={(e) => patch({ subtitle: e.currentTarget.value })}
          autosize
          minRows={2}
          maxRows={6}
        />
      </Stack>

      <Stack gap={10}>
        <SectionHeader title="Dokumenti" />
        {d.documents.length === 0 && (
          <Text size="sm" c="dimmed">Još nema dokumenata. Dodajte prvi dokument.</Text>
        )}
        {d.documents.map((doc, i) => (
          <DocumentRow
            key={doc.id}
            doc={doc}
            index={i}
            total={d.documents.length}
            onChange={(nd) => updateDoc(i, nd)}
            onRemove={() => removeDoc(i)}
            onMove={(dir) => moveDoc(i, dir)}
          />
        ))}
        <Box>
          <Button variant="secondary" size="sm" leftSection={<Plus size={14} />} onClick={addDoc}>
            Dodaj dokument
          </Button>
        </Box>
      </Stack>

      <Stack gap={10}>
        <SectionHeader title="Kontakt" />
        <ContactLinkField value={d.contactLink} onChange={(v) => patch({ contactLink: v })} />
      </Stack>
    </Stack>
  );
}

export const cataloguesBlock: BlockTypeDefinition = {
  type: "catalogues",
  label: "Catalogues",
  defaultData: DEFAULT_DATA as unknown as Record<string, unknown>,
  EditorComponent: CataloguesEditor,
  getLabel: (data) => {
    const d = normalize(data);
    const n = d.documents.length;
    return d.subtitle?.trim() || (n ? `Katalozi (${n})` : "Katalozi");
  },
};
