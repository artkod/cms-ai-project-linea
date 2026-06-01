import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Group, Stack, Text, TextInput, Textarea, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Button,
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
// (locale-shared) lucide icon. The active editing language follows the sidebar
// content-locale switcher (single source of truth), same as SEO / Site identity.
//
// Stored under the generic project-settings key "featured_banners" as:
//   { boxes: [{ icon, title: {hr,en}, content: {hr,en} }, …×3] }
// A future frontend component reads it via GET /api/project-settings/featured_banners.

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
    save: "Save",
    editingHint: (loc: string) =>
      `Editing the ${loc.toUpperCase()} version — switch language in the sidebar to translate. The icon is shared across languages.`,
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
    save: "Spremi",
    editingHint: (loc: string) =>
      `Uređujete ${loc.toUpperCase()} verziju — promijenite jezik u bočnoj traci za prijevod. Ikona je zajednička za sve jezike.`,
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
    try {
      const { version } = await saveProjectSettings(STORE_KEY, value, versionRef.current);
      versionRef.current = version;
      savedSnapshot.current = JSON.stringify(value);
      // Force a re-render so isDirty recomputes against the new snapshot.
      setValue((prev) => ({ boxes: [...prev.boxes] }));
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
        <Text size="xs" c="dimmed" mt={4}>{s.editingHint(contentLocale)}</Text>
      </div>

      {value.boxes.map((box, idx) => (
        <Box
          key={idx}
          style={{
            border: "1px solid var(--mantine-color-gray-3, #dee2e6)",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <Stack gap={12}>
            <Text
              size="sm"
              fw={700}
              style={{ letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--cms-ink-3, #6c7686)" }}
            >
              {s.box} {idx + 1}
            </Text>
            <IconPicker
              label={s.boxIcon}
              value={box.icon}
              onChange={(v) => patchBox(idx, { icon: v })}
            />
            <TextInput
              label={s.boxTitle}
              placeholder={s.boxTitlePh}
              value={box.title[contentLocale] ?? ""}
              onChange={(e) => setLocalized(idx, "title", e.currentTarget.value)}
            />
            <Textarea
              label={s.boxContent}
              placeholder={s.boxContentPh}
              value={box.content[contentLocale] ?? ""}
              onChange={(e) => setLocalized(idx, "content", e.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={8}
            />
          </Stack>
        </Box>
      ))}

      <Group justify="flex-end">
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty}>
          {s.save}
        </Button>
      </Group>
    </Stack>
  );
}

export const featuredBannersSection: SettingsSectionDef = {
  key: STORE_KEY,
  label: { en: "Featured banners", hr: "Istaknuti baneri" },
  icon: "LayoutPanelTop",
  roles: ["admin", "developer"],
  component: FeaturedBannersSection,
};
