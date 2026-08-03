import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Image as ImageIcon, Link2, Upload } from "lucide-react";
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
// about-us is a singleton-block page type: the page allows exactly one block of
// type "about-us", auto-seeded on create. All of the "O nama" page content is
// authored here — subtitle + description, and two buttons. Each button is a
// single LinkData object: the link picker now captures the button label
// ("Link text") + tooltip alongside the target, so there's no separate text
// field.
//
// Editor UI rebuilt on the admin-base kit (`ui.*`) 2026-08-03 — the raw
// Mantine version rendered unstyled after the core admin redesign deleted the
// old theme layer. Visual vocabulary mirrors core's TypedFieldsForm.

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      {value ? (
        <div style={rowBox}>
          <div style={{ width: 64, height: 40, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
            <img src={value.cdnUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {value.name || value.cdnUrl.split("/").pop()}
          </div>
          <ui.Button variant="secondary" size="sm" icon={ImageIcon} onClick={() => setOpen(true)}>Promijeni</ui.Button>
          <ui.Button variant="ghost" size="sm" onClick={() => onChange(null)}>Ukloni</ui.Button>
        </div>
      ) : (
        <div style={emptyBox}>
          <span style={{ color: "var(--ink-4)" }}><ImageIcon size={22} /></span>
          <ui.Button variant="secondary" size="sm" icon={Upload} onClick={() => setOpen(true)}>Odaberi sliku</ui.Button>
        </div>
      )}
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
    </div>
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
  label,
  value,
  onChange,
}: {
  label: string;
  value: LinkData | null;
  onChange: (v: LinkData | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const href = value ? computeLinkHref(value) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      {value ? (
        <div style={rowBox}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "600 12.5px/1.35 var(--font-ui)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value.linkText?.trim() || linkSummary(value)}
            </div>
            {href && (
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {href}
              </div>
            )}
          </div>
          <ui.Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Promijeni</ui.Button>
          <ui.Button variant="ghost" size="sm" onClick={() => onChange(null)}>Ukloni</ui.Button>
        </div>
      ) : (
        <div style={emptyBox}>
          <span style={{ color: "var(--ink-4)" }}><Link2 size={22} /></span>
          <ui.Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Postavi poveznicu</ui.Button>
        </div>
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
    </div>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function AboutUsEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);

  function patch(p: Partial<AboutUsData>) {
    onChange({ ...d, ...p } as unknown as Record<string, unknown>);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={sectionStyle}>
        <SectionHeader title="Osnovni podaci" />
        <ui.Input
          label="Alternativni naslov"
          placeholder="Alternativni naslov"
          value={d.altTitle}
          onChange={(e) => patch({ altTitle: (e.target as HTMLInputElement).value })}
        />
        <ImageField
          label="Hero slika"
          modalTitle="Odaberi hero sliku"
          value={d.heroImage}
          onChange={(v) => patch({ heroImage: v })}
        />
        <ui.Input
          label="Podnaslov"
          placeholder="Podnaslov"
          rows={3}
          value={d.subtitle}
          onChange={(e) => patch({ subtitle: (e.target as HTMLTextAreaElement).value })}
        />
      </div>

      <div style={sectionStyle}>
        <SectionHeader title="Gumbi" />
        <LinkField label="Gumb 1" value={d.btn1Link} onChange={(v) => patch({ btn1Link: v })} />
        <LinkField label="Gumb 2" value={d.btn2Link} onChange={(v) => patch({ btn2Link: v })} />
      </div>

      <div style={sectionStyle}>
        <SectionHeader title="Sekcija 2" />
        <ui.Input
          label="Naslov sekcije 2"
          placeholder="Naslov sekcije 2"
          value={d.section2Title}
          onChange={(e) => patch({ section2Title: (e.target as HTMLInputElement).value })}
        />
        <ui.Input
          label="Opis"
          placeholder="Opis"
          rows={5}
          value={d.description}
          onChange={(e) => patch({ description: (e.target as HTMLTextAreaElement).value })}
        />
      </div>

      <div style={sectionStyle}>
        <SectionHeader title="Sekcija 3" />
        <ui.Input
          label="Naslov sekcije 3"
          placeholder="Naslov sekcije 3"
          value={d.section3Title}
          onChange={(e) => patch({ section3Title: (e.target as HTMLInputElement).value })}
        />
        <ui.Input
          label="Podnaslov sekcije 3"
          placeholder="Podnaslov sekcije 3"
          rows={3}
          value={d.section3Subtitle}
          onChange={(e) => patch({ section3Subtitle: (e.target as HTMLTextAreaElement).value })}
        />
      </div>
    </div>
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
