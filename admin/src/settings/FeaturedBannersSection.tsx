import { useEffect, useMemo, useRef, useState } from "react";
import {
  ui,
  SettingsSection,
  useSettingsSave,
  IconPicker,
  useContentLocale,
  fetchProjectSettings,
  saveProjectSettings,
  ConflictError,
  type SettingsSectionDef,
} from "@cms/admin-base";

// ─── Featured banners ────────────────────────────────────────────────────────
//
// linea-only Settings section, injected via createAdmin({ settingsSections }).
// Three fixed boxes, each: per-locale title + per-locale content + a single
// (locale-shared) lucide icon. The active editing language follows the topbar
// content-locale switcher (single source of truth), same as SEO / Site identity.
//
// Stored under the generic project-settings key "featured_banners" as:
//   { boxes: [{ icon, title: {hr,en}, content: {hr,en} }, …×3] }
// A frontend component reads it via GET /api/project-settings/featured_banners.
//
// Chrome is composed from the admin-base design system (`SettingsSection` +
// `ui.*`) so it matches the built-in Settings tabs — see docs/design-system.md §2.

const STORE_KEY = "featured_banners";
const BOX_COUNT = 3;

interface Banner {
  icon: string | null;
  title: Record<string, string>;
  content: Record<string, string>;
}
interface FeaturedBannersValue {
  boxes: Banner[];
}

// ─── i18n for this section's chrome (kept out of core locale files) ──────────
const STRINGS = {
  en: {
    title: "Featured banners",
    subtitle: "Three reusable highlight boxes shown across the site.",
    box: "Box",
    boxIcon: "Icon",
    boxTitle: "Title",
    boxContent: "Content",
    boxTitlePh: "Box title",
    boxContentPh: "Short supporting text",
    editingHint: (loc: string) =>
      `Editing the ${loc.toUpperCase()} version — switch language in the topbar to translate. The icon is shared across languages.`,
    saved: "Featured banners saved",
    conflict: "Someone else saved these while you were editing. Reload to get the latest version.",
    saveFailed: "Couldn't save featured banners",
  },
  hr: {
    title: "Istaknuti baneri",
    subtitle: "Tri okvira za isticanje koja se koriste na više mjesta.",
    box: "Okvir",
    boxIcon: "Ikona",
    boxTitle: "Naslov",
    boxContent: "Sadržaj",
    boxTitlePh: "Naslov okvira",
    boxContentPh: "Kratki popratni tekst",
    editingHint: (loc: string) =>
      `Uređujete ${loc.toUpperCase()} verziju — promijenite jezik u gornjoj traci za prijevod. Ikona je zajednička za sve jezike.`,
    saved: "Istaknuti baneri spremljeni",
    conflict: "Netko je spremio promjene dok ste uređivali. Osvježite stranicu za najnoviju verziju.",
    saveFailed: "Spremanje istaknutih banera nije uspjelo",
  },
} as const;

function emptyBanner(): Banner {
  return { icon: null, title: {}, content: {} };
}

// Coerce arbitrary stored JSON into exactly BOX_COUNT well-formed banners.
function normalize(raw: unknown): FeaturedBannersValue {
  const boxesRaw = (raw as { boxes?: unknown })?.boxes;
  const arr = Array.isArray(boxesRaw) ? boxesRaw : [];
  const boxes: Banner[] = [];
  for (let i = 0; i < BOX_COUNT; i++) {
    const b = (arr[i] ?? {}) as Partial<Banner>;
    boxes.push({
      icon: typeof b.icon === "string" ? b.icon : null,
      title: b.title && typeof b.title === "object" ? (b.title as Record<string, string>) : {},
      content: b.content && typeof b.content === "object" ? (b.content as Record<string, string>) : {},
    });
  }
  return { boxes };
}

function FeaturedBannersSection() {
  const { locale: contentLocale } = useContentLocale();
  const uiLang = (localStorage.getItem("cms-ui-locale") as "en" | "hr" | null) ?? "en";
  const s = STRINGS[uiLang] ?? STRINGS.en;

  const [value, setValue] = useState<FeaturedBannersValue>({ boxes: [emptyBanner(), emptyBanner(), emptyBanner()] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const savedSnapshot = useRef<string>("");
  const versionRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetchProjectSettings<FeaturedBannersValue>(STORE_KEY)
      .then(({ value: v, version }) => {
        if (cancelled) return;
        const norm = normalize(v);
        setValue(norm);
        savedSnapshot.current = JSON.stringify(norm);
        versionRef.current = version;
      })
      .catch(() => {
        /* leave defaults; first save creates the row */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = useMemo(() => JSON.stringify(value) !== savedSnapshot.current, [value]);

  // Save lives in the Settings header actions row, same slot as the built-in
  // tabs (Sandro, 2026-07-29) — this section renders no button of its own.
  useSettingsSave({ dirty: isDirty, saving, onSave: handleSave });

  function patchBox(idx: number, p: Partial<Banner>) {
    setValue((prev) => {
      const boxes = prev.boxes.map((b, i) => (i === idx ? { ...b, ...p } : b));
      return { boxes };
    });
  }

  function setLocalized(idx: number, field: "title" | "content", text: string) {
    setValue((prev) => {
      const boxes = prev.boxes.map((b, i) =>
        i === idx ? { ...b, [field]: { ...b[field], [contentLocale]: text } } : b
      );
      return { boxes };
    });
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const { version } = await saveProjectSettings(STORE_KEY, value, versionRef.current);
      versionRef.current = version;
      savedSnapshot.current = JSON.stringify(value);
      // Force a re-render so isDirty recomputes against the new snapshot.
      setValue((prev) => ({ boxes: [...prev.boxes] }));
      setToast({ tone: "success", text: s.saved });
    } catch (err) {
      setToast({
        tone: "danger",
        text: err instanceof ConflictError ? s.conflict : s.saveFailed,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="cms-set-loading">…</div>;
  }

  return (
    <SettingsSection title={s.title} hint={s.subtitle}>
      {toast && (
        <ui.Banner tone={toast.tone} style={{ marginBottom: 16 }}>
          {toast.text}
        </ui.Banner>
      )}

      <ui.Banner tone="info" style={{ marginBottom: 16 }}>
        {s.editingHint(contentLocale)}
      </ui.Banner>

      <div className="cms-set-grid">
        {value.boxes.map((box, idx) => (
          <div key={idx} className="cms-set-box">
            <div className="cms-set-boxlabel">
              {s.box} {idx + 1}
            </div>
            <IconPicker
              label={s.boxIcon}
              value={box.icon}
              onChange={(v) => patchBox(idx, { icon: v })}
            />
            <ui.Input
              label={s.boxTitle}
              placeholder={s.boxTitlePh}
              value={box.title[contentLocale] ?? ""}
              onChange={(e) => setLocalized(idx, "title", e.currentTarget.value)}
            />
            <ui.Input
              label={s.boxContent}
              rows={3}
              placeholder={s.boxContentPh}
              value={box.content[contentLocale] ?? ""}
              onChange={(e) => setLocalized(idx, "content", e.currentTarget.value)}
            />
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

export const featuredBannersSection: SettingsSectionDef = {
  key: STORE_KEY,
  label: { en: "Featured banners", hr: "Istaknuti baneri" },
  icon: "LayoutPanelTop",
  roles: ["admin", "developer"],
  component: FeaturedBannersSection,
};
