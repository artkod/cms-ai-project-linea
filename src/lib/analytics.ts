// Consent-gated GA4 loader (core capability — see cms-ai-core
// docs/frontend-analytics.md). Storage-agnostic variant: the cookie banner
// (SiteModals + the `linea.cookieConsent` key) OWNS the consent decision, so
// this module only holds the measurement id and (un)loads gtag on demand.
//
// gtag.js is injected ONLY after the analytics category is granted; events DROP
// (return false) until then. Browser-only — every entry point no-ops without a
// DOM, so SSR imports are safe.

let measurementId: string | null = null;
let gtagLoaded = false;
let consentGranted = false;

const hasDom = () => typeof window !== "undefined" && typeof document !== "undefined";

/* eslint-disable @typescript-eslint/no-explicit-any */
function loadGtag(): void {
  if (!hasDom() || !measurementId || gtagLoaded) return;
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== "function") {
    w.gtag = function gtag() {
      w.dataLayer.push(arguments);
    };
  }
  w.gtag("js", new Date());
  w.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  w.gtag("config", measurementId, { anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);
  gtagLoaded = true;
}

/** Set the GA4 id (from site settings). If consent was already granted this
 *  session, loads gtag right away. Null/empty id = analytics stays off. */
export function initGa4(id: string | null | undefined): void {
  measurementId = id || null;
  if (measurementId && consentGranted) loadGtag();
}

/** Apply the analytics-category consent. `true` loads gtag (once); `false`
 *  keeps it off. Call on boot with the stored decision and whenever the banner
 *  saves a new one. */
export function applyAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  if (granted) loadGtag();
}

/** True when events would actually be sent (granted + gtag loaded). */
export function isAnalyticsActive(): boolean {
  return gtagLoaded && consentGranted;
}

/** Fire a GA4 event — sends NOTHING (returns false) unless analytics consent is
 *  granted and gtag is loaded. */
export function trackEvent(name: string, params?: Record<string, unknown>): boolean {
  if (!hasDom() || !isAnalyticsActive()) return false;
  (window as any).gtag("event", name, params ?? {});
  return true;
}
