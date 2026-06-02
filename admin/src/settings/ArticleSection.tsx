import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Stack, Text, TagsInput, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Button,
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
    placeholder: "start typing…",
    save: "Save",
    saved: "Article types saved",
    conflict: "Someone else saved these while you were editing. Reload to get the latest version.",
    saveFailed: "Couldn't save article types",
  },
  hr: {
    title: "Članak",
    subtitle: "Uredite popis vrsta članaka. Svaka vrijednost postaje dostupna u padajućem izborniku „Vrsta članka” na stranici članka.",
    typesLabel: "Vrste članaka",
    placeholder: "počnite tipkati…",
    save: "Spremi",
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

  async function handleSave() {
    setSaving(true);
    try {
      const { version } = await saveProjectSettings(STORE_KEY, value, versionRef.current);
      versionRef.current = version;
      savedSnapshot.current = JSON.stringify(value);
      setValue((prev) => ({ ...prev }));
      notifications.show({ message: s.saved, color: "teal" });
    } catch (err) {
      if (err instanceof ConflictError) {
        notifications.show({ message: s.conflict, color: "red", autoClose: false });
      } else {
        notifications.show({ message: s.saveFailed, color: "red" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <div>
        <Text fw={700} size="lg">{s.title}</Text>
        <Text size="sm" c="dimmed">{s.subtitle}</Text>
      </div>

      <TagsInput
        label={s.typesLabel}
        placeholder={s.placeholder}
        value={value.options}
        onChange={(opts) => setValue({ options: opts })}
        clearable
      />

      <Group justify="flex-end">
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty}>
          {s.save}
        </Button>
      </Group>
    </Stack>
  );
}

export const articleSection: SettingsSectionDef = {
  key: STORE_KEY,
  label: { en: "Article", hr: "Članak" },
  icon: "Newspaper",
  roles: ["admin", "developer"],
  component: ArticleSection,
};
