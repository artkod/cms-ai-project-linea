import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Stack, Text, TextInput, Loader } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Button,
  fetchProjectSettings,
  saveProjectSettings,
  ConflictError,
  type SettingsSectionDef,
} from "@cms/admin-base";

// ─── Kontakt ─────────────────────────────────────────────────────────────────
//
// linea-only Settings section. A single set of contact details (not per-locale —
// phone/fax/email/address/maps link are the same regardless of language).
//
// Stored under the generic project-settings key "contact" as:
//   { phone, fax, email, address, mapsUrl }
// A frontend component reads it via GET /api/project-settings/contact.

const STORE_KEY = "contact";

interface ContactValue {
  phone: string;
  fax: string;
  email: string;
  address: string;
  mapsUrl: string;
}

const EMPTY: ContactValue = { phone: "", fax: "", email: "", address: "", mapsUrl: "" };

// Lenient email check — empty is allowed (field is optional); a non-empty value
// must look like an address before Save is enabled.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STRINGS = {
  en: {
    title: "Contact",
    subtitle: "Contact details shown across the site.",
    phone: "Phone",
    fax: "Fax",
    email: "Email",
    emailInvalid: "Enter a valid email address",
    address: "Address",
    mapsUrl: "Google Maps location link",
    save: "Save",
    saved: "Contact details saved",
    conflict: "Someone else saved these while you were editing. Reload to get the latest version.",
    saveFailed: "Couldn't save contact details",
  },
  hr: {
    title: "Kontakt",
    subtitle: "Kontakt podaci prikazani na stranici.",
    phone: "Telefon",
    fax: "Fax",
    email: "Email",
    emailInvalid: "Unesite ispravnu email adresu",
    address: "Adresa",
    mapsUrl: "Google Maps poveznica lokacije",
    save: "Spremi",
    saved: "Kontakt podaci spremljeni",
    conflict: "Netko je spremio promjene dok ste uređivali. Osvježite stranicu za najnoviju verziju.",
    saveFailed: "Spremanje kontakt podataka nije uspjelo",
  },
} as const;

function normalize(raw: unknown): ContactValue {
  const r = (raw ?? {}) as Partial<ContactValue>;
  return {
    phone: typeof r.phone === "string" ? r.phone : "",
    fax: typeof r.fax === "string" ? r.fax : "",
    email: typeof r.email === "string" ? r.email : "",
    address: typeof r.address === "string" ? r.address : "",
    mapsUrl: typeof r.mapsUrl === "string" ? r.mapsUrl : "",
  };
}

function ContactSection() {
  const uiLang = (localStorage.getItem("cms-ui-locale") as "en" | "hr" | null) ?? "en";
  const s = STRINGS[uiLang] ?? STRINGS.en;

  const [value, setValue] = useState<ContactValue>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedSnapshot = useRef<string>("");
  const versionRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetchProjectSettings<ContactValue>(STORE_KEY)
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

  const emailInvalid = value.email.trim() !== "" && !EMAIL_RE.test(value.email.trim());
  const isDirty = useMemo(() => JSON.stringify(value) !== savedSnapshot.current, [value]);

  function set<K extends keyof ContactValue>(key: K, v: ContactValue[K]) {
    setValue((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    if (emailInvalid) return;
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

      <Stack gap={12} style={{ maxWidth: 520 }}>
        <TextInput
          label={s.phone}
          value={value.phone}
          onChange={(e) => set("phone", e.currentTarget.value)}
        />
        <TextInput
          label={s.fax}
          value={value.fax}
          onChange={(e) => set("fax", e.currentTarget.value)}
        />
        <TextInput
          label={s.email}
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.currentTarget.value)}
          error={emailInvalid ? s.emailInvalid : undefined}
        />
        <TextInput
          label={s.address}
          value={value.address}
          onChange={(e) => set("address", e.currentTarget.value)}
        />
        <TextInput
          label={s.mapsUrl}
          placeholder="https://maps.google.com/…"
          value={value.mapsUrl}
          onChange={(e) => set("mapsUrl", e.currentTarget.value)}
        />
      </Stack>

      <Group justify="flex-end" style={{ maxWidth: 520 }}>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty || emailInvalid}>
          {s.save}
        </Button>
      </Group>
    </Stack>
  );
}

export const contactSection: SettingsSectionDef = {
  key: STORE_KEY,
  label: { en: "Contact", hr: "Kontakt" },
  icon: "Contact",
  roles: ["admin", "developer"],
  component: ContactSection,
};
