import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router";
import { RootLayout } from "./routes/RootLayout";
import { HomePage } from "./routes/HomePage";
import { PageView } from "./routes/PageView";
import { LocaleConfigProvider, isKnownLocale, useLocaleConfig } from "./lib/locale";

// Routes nested under `/:locale/` only render when `:locale` is one of the
// project's available locales. Anything else is treated as a legacy single-
// segment slug and 301-style redirected to `/{defaultLocale}/{slug}`.

function LocaleGate() {
  const params = useParams();
  const locale = params.locale;
  const splat = params["*"] ?? "";
  const { search } = useLocation();
  const { availableLocales, defaultLocale } = useLocaleConfig();
  if (!isKnownLocale(locale, availableLocales)) {
    // Treat the whole path as locale-less: /a/b/c → /{defaultLocale}/a/b/c.
    // Reconstruct the full hierarchical path (locale segment + splat). Carry
    // the query string through — the admin's preview links live there
    // (?previewToken=…) and dropping them silently sends previewers to the
    // published version instead of the draft.
    const rest = [locale, splat].filter(Boolean).join("/");
    return <Navigate to={`/${defaultLocale}/${rest}${search}`} replace />;
  }
  return <RootLayout />;
}

function RootRedirect() {
  const { defaultLocale } = useLocaleConfig();
  return <Navigate to={`/${defaultLocale}/`} replace />;
}

export default function App() {
  return (
    <LocaleConfigProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/:locale" element={<LocaleGate />}>
            <Route index element={<HomePage />} />
            {/* Splat captures the full hierarchical path (e.g. proizvodi/busilice/x).
                PageView resolves it and redirects home when unmatched. */}
            <Route path="*" element={<PageView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LocaleConfigProvider>
  );
}
