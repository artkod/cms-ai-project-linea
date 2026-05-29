import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSiteSettings, getStrings, type Alternates, type SiteSettings } from "./api";

interface LocaleConfig {
  defaultLocale: string;
  availableLocales: string[];
  settings: SiteSettings | null;
  // Tell the provider which locale is active so multilingual siteSettings
  // fields (siteTitle, tagline, default SEO) come back in that locale. Safe
  // to call repeatedly with the same value — the provider de-dupes.
  setActiveLocale: (locale: string) => void;
}

const LocaleConfigContext = createContext<LocaleConfig | null>(null);

const FALLBACK = {
  defaultLocale: "hr",
  availableLocales: ["hr", "en"],
  settings: null,
};

export function LocaleConfigProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [bootstrap, setBootstrap] = useState<{ defaultLocale: string; availableLocales: string[] } | null>(null);
  const [activeLocale, setActiveLocaleState] = useState<string | null>(null);

  // Bootstrap fetch — defaultLocale/availableLocales come from this call. The
  // multilingual text fields it returns are scoped to defaultLocale by the
  // API and overwritten as soon as RootLayout sets the active locale.
  useEffect(() => {
    let cancelled = false;
    getSiteSettings()
      .then((s) => {
        if (cancelled) return;
        if (!s) {
          setBootstrap({ defaultLocale: FALLBACK.defaultLocale, availableLocales: FALLBACK.availableLocales });
          setSettings(null);
          return;
        }
        setBootstrap({
          defaultLocale: s.defaultLocale || FALLBACK.defaultLocale,
          availableLocales:
            Array.isArray(s.availableLocales) && s.availableLocales.length > 0
              ? s.availableLocales
              : FALLBACK.availableLocales,
        });
        setSettings(s);
      })
      .catch(() => {
        if (!cancelled) {
          setBootstrap({ defaultLocale: FALLBACK.defaultLocale, availableLocales: FALLBACK.availableLocales });
          setSettings(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch whenever the active locale changes (after bootstrap). The server
  // flattens multilingual fields to the requested locale, falling back to
  // defaultLocale per key.
  useEffect(() => {
    if (!bootstrap || !activeLocale) return;
    let cancelled = false;
    getSiteSettings(activeLocale)
      .then((s) => {
        if (cancelled || !s) return;
        setSettings(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeLocale, bootstrap]);

  const setActiveLocale = useCallback((locale: string) => {
    setActiveLocaleState((prev) => (prev === locale ? prev : locale));
  }, []);

  const value = useMemo<LocaleConfig | null>(() => {
    if (!bootstrap) return null;
    return {
      defaultLocale: bootstrap.defaultLocale,
      availableLocales: bootstrap.availableLocales,
      settings,
      setActiveLocale,
    };
  }, [bootstrap, settings, setActiveLocale]);

  if (!value) return null;
  return <LocaleConfigContext.Provider value={value}>{children}</LocaleConfigContext.Provider>;
}

export function useLocaleConfig(): LocaleConfig {
  const v = useContext(LocaleConfigContext);
  if (!v) throw new Error("useLocaleConfig must be used inside <LocaleConfigProvider>");
  return v;
}

/** Returns true when `candidate` is one of the project's available locales. */
export function isKnownLocale(candidate: string | undefined, available: string[]): candidate is string {
  return !!candidate && available.includes(candidate);
}

// ─── Page-level alternates context ────────────────────────────────────────────
// PageView publishes the active page's `alternates` map so the LanguageSwitcher
// (rendered up in RootLayout) can offer per-locale slug-preserving navigation.

interface PageAlternatesValue {
  alternates: Alternates | null;
  setAlternates: (a: Alternates | null) => void;
}

const PageAlternatesContext = createContext<PageAlternatesValue | null>(null);

export function PageAlternatesProvider({ children }: { children: ReactNode }) {
  const [alternates, setAlternates] = useState<Alternates | null>(null);
  const value = useMemo(() => ({ alternates, setAlternates }), [alternates]);
  return <PageAlternatesContext.Provider value={value}>{children}</PageAlternatesContext.Provider>;
}

export function usePageAlternates(): PageAlternatesValue {
  const v = useContext(PageAlternatesContext);
  if (!v) throw new Error("usePageAlternates must be used inside <PageAlternatesProvider>");
  return v;
}

// ─── Project translation strings (I7) ────────────────────────────────────────
// Loaded from `/api/strings?locale=…` on every active-locale change. `t(key)`
// returns the editor-managed value, or the key itself if missing/empty — so a
// developer rendering `t('hero_title')` before adding it to the admin sees
// the literal key in the browser, which is an obvious "fill me in" signal.

interface StringsValue {
  t: (key: string) => string;
  strings: Record<string, string>;
  ready: boolean;
}

const StringsContext = createContext<StringsValue | null>(null);

export function StringsProvider({ locale, children }: { locale: string; children: ReactNode }) {
  const [strings, setStrings] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    getStrings(locale)
      .then((m) => {
        if (!cancelled) {
          setStrings(m);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStrings({});
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback(
    (key: string): string => {
      const v = strings[key];
      if (typeof v === "string" && v !== "") return v;
      return key;
    },
    [strings]
  );

  const value = useMemo<StringsValue>(() => ({ t, strings, ready }), [t, strings, ready]);
  return <StringsContext.Provider value={value}>{children}</StringsContext.Provider>;
}

export function useStrings(): StringsValue {
  const v = useContext(StringsContext);
  if (!v) throw new Error("useStrings must be used inside <StringsProvider>");
  return v;
}
