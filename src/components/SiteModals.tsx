import { useEffect, useState } from "react";
import { Cookie, X, Mail, Check } from "lucide-react";
import { useStrings } from "@/lib/locale";
import "@/styles/components/modals.scss";

// Global cookie consent + newsletter, mounted once at the site shell.
//  • Cookie banner: shown only when nothing is stored yet. Accept / Reject /
//    Save-preferences all persist *something* (no real tracking is gated on it).
//  • Newsletter: pops 30s after load, once ever — closing it sets a "seen" flag
//    so it never reappears unless triggered manually (a future button can fire
//    the `linea:open-newsletter` window event).
//  • Cookie preferences can likewise be re-opened via `linea:open-cookie-prefs`.

const CONSENT_KEY = "linea.cookieConsent";
const NEWSLETTER_KEY = "linea.newsletterSeen";
const NEWSLETTER_DELAY_MS = 30_000;

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeFlag(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

function CookieCategory({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="ck-cat">
      <div>
        <h4 className="ck-cat__h">{title}</h4>
        <p className="ck-cat__d">{desc}</p>
      </div>
      <label className="sw">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
        <span className="sw__track" />
      </label>
    </div>
  );
}

export function SiteModals() {
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [bannerOpen, setBannerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [nlOpen, setNlOpen] = useState(false);
  const [nlDone, setNlDone] = useState(false);
  const [nlEmail, setNlEmail] = useState("");

  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [functional, setFunctional] = useState(true);

  // Cookie banner — only when nothing stored.
  useEffect(() => {
    if (!readFlag(CONSENT_KEY)) setBannerOpen(true);
  }, []);

  function saveConsent(value: Record<string, boolean>) {
    writeFlag(CONSENT_KEY, JSON.stringify({ ...value, ts: Date.now() }));
    setBannerOpen(false);
    setPrefsOpen(false);
  }

  // Newsletter — 30s after load, once ever.
  useEffect(() => {
    if (readFlag(NEWSLETTER_KEY)) return;
    const id = window.setTimeout(() => setNlOpen(true), NEWSLETTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  function closeNewsletter() {
    writeFlag(NEWSLETTER_KEY, "1");
    setNlOpen(false);
    window.setTimeout(() => {
      setNlDone(false);
      setNlEmail("");
    }, 220);
  }

  // Manual triggers for future buttons.
  useEffect(() => {
    const openNl = () => {
      setNlDone(false);
      setNlEmail("");
      setNlOpen(true);
    };
    const openPrefs = () => setPrefsOpen(true);
    window.addEventListener("linea:open-newsletter", openNl);
    window.addEventListener("linea:open-cookie-prefs", openPrefs);
    return () => {
      window.removeEventListener("linea:open-newsletter", openNl);
      window.removeEventListener("linea:open-cookie-prefs", openPrefs);
    };
  }, []);

  // Body scroll lock + Esc while a modal overlay is open.
  useEffect(() => {
    if (!prefsOpen && !nlOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (prefsOpen) setPrefsOpen(false);
      if (nlOpen) closeNewsletter();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [prefsOpen, nlOpen]);

  return (
    <>
      {/* ── Cookie consent banner ── */}
      <div className={`ck-banner${bannerOpen ? " is-open" : ""}`} role="dialog" aria-label={tx("cookies.banner_title", "Kolačići")}>
        <div className="ck-banner__ico"><Cookie aria-hidden="true" /></div>
        <div className="ck-banner__txt">
          <h3>{tx("cookies.banner_title", "Kolačići")}</h3>
          <p>{tx("cookies.banner_text", "Koristimo kolačiće za bolje iskustvo pregledavanja i analizu prometa.")}</p>
        </div>
        <div className="ck-banner__actions">
          <button type="button" className="ck-textbtn" onClick={() => { setBannerOpen(false); setPrefsOpen(true); }}>
            {tx("cookies.settings", "Postavke")}
          </button>
          <button type="button" className="ln-btn ln-btn--ghost" onClick={() => saveConsent({ analytics: false, marketing: false, functional: false })}>
            {tx("cookies.reject", "Odbij")}
          </button>
          <button type="button" className="ln-btn ln-btn--primary" onClick={() => saveConsent({ analytics: true, marketing: true, functional: true })}>
            {tx("cookies.accept_all", "Prihvati sve")}
          </button>
        </div>
      </div>

      {/* ── Cookie preferences modal ── */}
      {prefsOpen && (
        <div className="lm-overlay is-open" role="dialog" aria-modal="true" aria-label={tx("cookies.prefs_title", "Postavke kolačića")}>
          <div className="lm-overlay__bg" onClick={() => setPrefsOpen(false)} />
          <div className="lm-modal">
            <button type="button" className="lm-x" aria-label={tx("cookies.close", "Zatvori")} onClick={() => setPrefsOpen(false)}>
              <X aria-hidden="true" />
            </button>
            <div className="lm-modal__body">
              <div className="lm-icon"><Cookie aria-hidden="true" /></div>
              <h2>{tx("cookies.prefs_title", "Postavke kolačića")}</h2>
              <p className="lm-modal__lead">{tx("cookies.prefs_lead", "Upravljajte kategorijama kolačića. Nužni kolačići uvijek su aktivni jer su potrebni za ispravan rad stranice.")}</p>
              <div className="ck-cats">
                <div className="ck-cat">
                  <div>
                    <h4 className="ck-cat__h">{tx("cookies.cat_necessary", "Nužni kolačići")}</h4>
                    <p className="ck-cat__d">{tx("cookies.cat_necessary_desc", "Potrebni za osnovne funkcije i sigurnost stranice.")}</p>
                  </div>
                  <span className="ck-cat__always">{tx("cookies.always_active", "Uvijek aktivni")}</span>
                </div>
                <CookieCategory
                  title={tx("cookies.cat_analytics", "Analitički kolačići")}
                  desc={tx("cookies.cat_analytics_desc", "Pomažu nam razumjeti kako se stranica koristi.")}
                  checked={analytics}
                  onChange={setAnalytics}
                />
                <CookieCategory
                  title={tx("cookies.cat_marketing", "Marketing kolačići")}
                  desc={tx("cookies.cat_marketing_desc", "Koriste se za prikaz relevantnih sadržaja i ponuda.")}
                  checked={marketing}
                  onChange={setMarketing}
                />
                <CookieCategory
                  title={tx("cookies.cat_functional", "Funkcionalni kolačići")}
                  desc={tx("cookies.cat_functional_desc", "Omogućuju napredne značajke i personalizaciju.")}
                  checked={functional}
                  onChange={setFunctional}
                />
              </div>
              <div className="lm-actions">
                <button type="button" className="ln-btn ln-btn--ghost" onClick={() => saveConsent({ analytics: true, marketing: true, functional: true })}>
                  {tx("cookies.accept_all", "Prihvati sve")}
                </button>
                <button type="button" className="ln-btn ln-btn--primary" onClick={() => saveConsent({ analytics, marketing, functional })}>
                  {tx("cookies.save", "Spremi postavke")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Newsletter modal ── */}
      {nlOpen && (
        <div className="lm-overlay is-open" role="dialog" aria-modal="true" aria-label={tx("newsletter.title", "Pretplatite se na novosti")}>
          <div className="lm-overlay__bg" onClick={closeNewsletter} />
          <div className="lm-modal">
            <button type="button" className="lm-x" aria-label={tx("cookies.close", "Zatvori")} onClick={closeNewsletter}>
              <X aria-hidden="true" />
            </button>
            <div className="lm-modal__body">
              {nlDone ? (
                <div className="nl-success">
                  <div className="lm-icon"><Check aria-hidden="true" /></div>
                  <h2>{tx("newsletter.success_title", "Hvala na pretplati!")}</h2>
                  <p>{tx("newsletter.success_text", "Potvrda je poslana na vašu adresu. Vidimo se u prvom izdanju.")}</p>
                  <button type="button" className="ln-btn ln-btn--ghost" style={{ marginTop: 24 }} onClick={closeNewsletter}>
                    {tx("cookies.close", "Zatvori")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="lm-icon"><Mail aria-hidden="true" /></div>
                  <h2>{tx("newsletter.title", "Pretplatite se na novosti")}</h2>
                  <p className="lm-modal__lead">{tx("newsletter.lead", "Primajte obavijesti o novim proizvodima, akcijama i projektima — povremeno i bez spama.")}</p>
                  <form onSubmit={(e) => { e.preventDefault(); setNlDone(true); }} noValidate>
                    <div className="nl-field">
                      <label htmlFor="nlEmail">{tx("newsletter.email", "Email adresa")}</label>
                      <input
                        id="nlEmail"
                        className="nl-input"
                        type="email"
                        value={nlEmail}
                        onChange={(e) => setNlEmail(e.currentTarget.value)}
                        placeholder="vasa@adresa.hr"
                      />
                    </div>
                    <button type="submit" className="ln-btn ln-btn--primary ln-btn--lg nl-submit">
                      {tx("newsletter.submit", "Pretplati se")}
                    </button>
                    <p className="nl-note">{tx("newsletter.note", "Možete se odjaviti u bilo kojem trenutku.")}</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
