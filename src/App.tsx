import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router";
import { RootLayout } from "./routes/RootLayout";
import { HomePage } from "./routes/HomePage";
import { PageView } from "./routes/PageView";
import { NotFound } from "./routes/NotFound";
import { LocaleConfigProvider, isKnownLocale, useLocaleConfig } from "./lib/locale";

// Routes nested under `/:locale/` only render when `:locale` is one of the
// project's available locales. Anything else is treated as a legacy single-
// segment slug and 301-style redirected to `/{defaultLocale}/{slug}`.

function LocaleGate() {
  const { locale } = useParams<{ locale: string }>();
  const { search } = useLocation();
  const { availableLocales, defaultLocale } = useLocaleConfig();
  if (!isKnownLocale(locale, availableLocales)) {
    // Treat the segment as a legacy slug: /:slug → /{defaultLocale}/:slug.
    // Carry the query string through — the admin's preview links live there
    // (?previewToken=…) and dropping them silently sends previewers to the
    // published version instead of the draft.
    return <Navigate to={`/${defaultLocale}/${locale ?? ""}${search}`} replace />;
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
            <Route path=":slug" element={<PageView />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LocaleConfigProvider>
  );
}
