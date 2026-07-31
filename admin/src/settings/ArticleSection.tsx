import { useEffect, useMemo, useRef, useState } from "react";
import {
  ui,
  SettingsSection,
  ChipsInput,
  useSettingsSave,
  fetchProjectSettings,
  saveProjectSettings,
  ConflictError,
  type SettingsSectionDef,
} from "@cms/admin-base";

// ─── Article ──────────────────────────────────────────────────────────────────
//
// linea-only Settings section. Holds the editable list of "article types" — the
// values that become the `articleType` dropdown on the `article` page type.
//
// Stored under the generic project-settings key "article" as:
//   { options: string[] }
// The admin-base `select` field with `optionsSource: "article"` reads this list
// (GET /api/project-settings/article) and renders it as a dropdown on the page.
//
// Chrome is composed from the admin-base design system (`SettingsSection` +
// `ChipsInput` + `ui.*`) so it matches the built-in Settings tabs — see
// docs/design-system.md §2.

const STORE_KEY = "article";

interface ArticleValue {
  options: string[];
}

const EMPTY: ArticleValue = { options: [] };

const STRINGS = {
  en: {
    title: "Article",
    subtitle: "Manage the list of article types. Each value becomes selectable in the article page's “Article type” dropdown.",
    typesLabel: "Article types",
    typesHint: "Press Enter or comma to add a type; Backspace removes the last one.",
    placeholder: "Add a type…",
    remove: "Remove {{value}}",
    saved: "Article types saved",
    conflict: "Someone else saved these while you were editing. Reload to get the latest version.",
    saveFailed: "Couldn't save article types",
  },
  hr: {
    title: "Članak",
    subtitle: "Uredite popis vrsta članaka. Svaka vrijednost postaje dostupna u padajućem izborniku „Vrsta članka” na stranici članka.",
    typesLabel: "Vrste članaka",
    typesHint: "Pritisnite Enter ili zarez za dodavanje; Backspace briše zadnju.",
    placeholder: "Dodajte vrstu…",
    remove: "Ukloni {{value}}",
    saved: "Vrste članaka spremljene",
    conflict: "Netko je spremio promjene dok ste uređivali. Osvježite stranicu za najnoviju verziju.",
    saveFailed: "Spremanje vrsta članaka nije uspjelo",
  },
} as const;

function normalize(raw: unknown): ArticleValue {
  const r = (raw ?? {}) as Partial<ArticleValue>;
  const options = Array.isArray(r.options)
    ? r.options.filter((v): v is string => typeof v === "string")
    : [];
  return { options };
}

function ArticleSection() {
  const uiLang = (localStorage.getItem("cms-ui-locale") as "en" | "hr" | null) ?? "en";
  const s = STRINGS[uiLang] ?? STRINGS.en;

  const [value, setValue] = useState<ArticleValue>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const savedSnapshot = useRef<string>("");
  const versionRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetchProjectSettings<ArticleValue>(STORE_KEY)
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

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const { version } = await saveProjectSettings(STORE_KEY, value, versionRef.current);
      versionRef.current = version;
      savedSnapshot.current = JSON.stringify(value);
      setValue((prev) => ({ ...prev }));
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
      <div>
        <label className="cms-set-label">{s.typesLabel}</label>
        <ChipsInput
          values={value.options}
          onChange={(options) => setValue({ options })}
          addLabel={s.placeholder}
          removeLabel={s.remove}
        />
        <div className="cms-set-fieldhint" style={{ marginTop: 6 }}>{s.typesHint}</div>
      </div>
    </SettingsSection>
  );
}

export const articleSection: SettingsSectionDef = {
  key: STORE_KEY,
  label: { en: "Article", hr: "Članak" },
  icon: "Newspaper",
  roles: ["admin", "developer"],
  component: ArticleSection,
};
