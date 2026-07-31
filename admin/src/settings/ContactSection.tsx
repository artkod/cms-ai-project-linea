import { useEffect, useMemo, useRef, useState } from "react";
import {
  ui,
  SettingsSection,
  useSettingsSave,
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
//
// Chrome is composed from the admin-base design system (`SettingsSection` +
// `ui.*`) so it matches the built-in Settings tabs — see docs/design-system.md §2.

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
  const [toast, setToast] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
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

  // Save lives in the Settings header actions row, same slot as the built-in
  // tabs (Sandro, 2026-07-29) — this section renders no button of its own.
  useSettingsSave({ dirty: isDirty && !emailInvalid, saving, onSave: handleSave });

  function set<K extends keyof ContactValue>(key: K, v: ContactValue[K]) {
    setValue((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    if (emailInvalid) return;
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
      <div className="cms-set-grid">
        <div className="cms-set-row2">
          <ui.Input label={s.phone} value={value.phone} onChange={(e) => set("phone", e.currentTarget.value)} />
          <ui.Input label={s.fax} value={value.fax} onChange={(e) => set("fax", e.currentTarget.value)} />
        </div>
        <ui.Input
          label={s.email}
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.currentTarget.value)}
          error={emailInvalid ? s.emailInvalid : undefined}
          spellCheck={false}
        />
        <ui.Input label={s.address} value={value.address} onChange={(e) => set("address", e.currentTarget.value)} />
        <ui.Input
          label={s.mapsUrl}
          mono
          placeholder="https://maps.google.com/…"
          value={value.mapsUrl}
          onChange={(e) => set("mapsUrl", e.currentTarget.value)}
          spellCheck={false}
        />
      </div>
    </SettingsSection>
  );
}

export const contactSection: SettingsSectionDef = {
  key: STORE_KEY,
  label: { en: "Contact", hr: "Kontakt" },
  icon: "Contact",
  roles: ["admin", "developer"],
  component: ContactSection,
};
