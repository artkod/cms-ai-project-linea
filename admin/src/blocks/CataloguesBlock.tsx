import { useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import { FileText, Link2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { blockStrings } from "./blockStrings";
import {
  ui,
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
//
// Editor UI rebuilt on the admin-base kit (`ui.*`) 2026-08-03 — the raw
// Mantine version rendered unstyled after the core admin redesign deleted the
// old theme layer. Visual vocabulary mirrors core's TypedFieldsForm.

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

// ─── Shared kit-style vocabulary (mirrors core TypedFieldsForm) ───────────────

const sectionStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 12 };

const rowBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  border: "1px solid var(--border)",
  borderRadius: "var(--r-lg)",
  padding: "10px 12px",
  background: "var(--surface)",
};

const emptyBox: CSSProperties = {
  border: "1.5px dashed var(--border-strong)",
  borderRadius: "var(--r-lg)",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 9,
  textAlign: "center",
  background: "var(--surface)",
};

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ font: "700 10.5px/1 var(--font-ui)", letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink-4)" }}>
      {title}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{ font: "600 11px/1.35 var(--font-ui)", letterSpacing: ".01em", color: "var(--ink-2)" }}>
      {children}
    </label>
  );
}

// ─── Contact CTA link field ──────────────────────────────────────────────────

function linkSummary(d: LinkData, L: ReturnType<typeof blockStrings>): string {
  switch (d.linkType) {
    case "page":
      return d.pageTitle ? `${L.linkPage}: ${d.pageTitle}` : L.linkPage;
    case "remote":
      return d.url || "URL";
    case "email":
      return d.email ? `${L.linkEmail}: ${d.email}` : L.linkEmail;
    default:
      return L.linkFallback;
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
  const L = blockStrings();
  const href = value ? computeLinkHref(value) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{L.contactBtn}</FieldLabel>
      {value ? (
        <div style={rowBox}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 12.5px/1.35 var(--font-ui)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value.linkText?.trim() || linkSummary(value, L)}
            </div>
            {href && (
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {href}
              </div>
            )}
          </div>
          <ui.Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{L.change}</ui.Button>
          <ui.Button variant="ghost" size="sm" onClick={() => onChange(null)}>{L.remove}</ui.Button>
        </div>
      ) : (
        <div style={emptyBox}>
          <span style={{ color: "var(--ink-4)" }}><Link2 size={22} /></span>
          <ui.Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{L.setLink}</ui.Button>
        </div>
      )}
      <LinkPickerModal
        mode="rte"
        showTextFields
        opened={open}
        onClose={() => setOpen(false)}
        initialData={value ?? undefined}
        onConfirm={(d: LinkData) => {
          onChange(d);
          setOpen(false);
        }}
      />
    </div>
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
  const L = blockStrings();
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 12,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: "var(--r-md)", background: "var(--sunken)", color: "var(--ink-3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
          <FileText size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {doc.file ? (
            <>
              <div style={{ font: "600 12.5px/1.35 var(--font-ui)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {doc.file.name || L.linkFallback}
              </div>
              {formatSize(doc.file.size) && (
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{formatSize(doc.file.size)}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L.noFile}</div>
          )}
        </div>
        <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <ui.IconButton icon={ArrowUp} label={L.moveUp} variant="bordered" size={28} iconSize={14} disabled={index === 0} onClick={() => onMove(-1)} />
          <ui.IconButton icon={ArrowDown} label={L.moveDown} variant="bordered" size={28} iconSize={14} disabled={index === total - 1} onClick={() => onMove(1)} />
          <ui.IconButton icon={Trash2} label={L.removeDoc} variant="danger-soft" size={28} iconSize={14} onClick={onRemove} />
        </span>
      </div>

      {/* Title + document picker share one row — full-width controls read
          overly stretched on wide screens (Sandro, 2026-08-03). */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <ui.Input
          label={L.displayTitle}
          placeholder={L.displayTitlePh}
          value={doc.title}
          onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...doc, title: (e.target as HTMLInputElement).value })}
          style={{ flex: 1, minWidth: 220 }}
        />
        <ui.Button
          variant="secondary"
          icon={FileText}
          style={{ height: "var(--control-h-lg)", flexShrink: 0 }}
          onClick={() => setOpen(true)}
        >
          {doc.file ? L.changeDoc : L.pickDoc}
        </ui.Button>
      </div>

      <ImagePickerModal
        opened={open}
        onClose={() => setOpen(false)}
        title={L.pickerTitle}
        mode="single"
        fileType="document"
        onConfirm={(files: GalleryImage[]) => {
          const f = files[0];
          if (f) onChange({ ...doc, file: f, title: doc.title || titleFromFilename(f.name) });
          setOpen(false);
        }}
      />
    </div>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function CataloguesEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);
  const L = blockStrings();

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
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={sectionStyle}>
        <SectionHeader title={L.intro} />
        <ui.Input
          label={L.subtitle}
          placeholder={L.subtitlePh}
          rows={3}
          value={d.subtitle}
          onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch({ subtitle: (e.target as HTMLTextAreaElement).value })}
        />
      </div>

      <div style={sectionStyle}>
        <SectionHeader title={L.documents} />
        {d.documents.length === 0 && (
          <div style={emptyBox}>
            <span style={{ color: "var(--ink-4)" }}><FileText size={22} /></span>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{L.noDocs}</div>
          </div>
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
        <div>
          <ui.Button variant="secondary" size="sm" icon={Plus} onClick={addDoc}>
            {L.addDoc}
          </ui.Button>
        </div>
      </div>

      <div style={sectionStyle}>
        <SectionHeader title={L.contact} />
        <ContactLinkField value={d.contactLink} onChange={(v) => patch({ contactLink: v })} />
      </div>
    </div>
  );
}

export const cataloguesBlock: BlockTypeDefinition = {
  type: "catalogues",
  label: "Catalogues",
  defaultData: DEFAULT_DATA as unknown as Record<string, unknown>,
  EditorComponent: CataloguesEditor,
  getLabel: (data: Record<string, unknown>) => {
    const d = normalize(data);
    const n = d.documents.length;
    return d.subtitle?.trim() || (n ? `Katalozi (${n})` : "Katalozi");
  },
};
