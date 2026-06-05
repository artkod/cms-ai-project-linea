import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Modal, AspectRatio, Button } from "@mantine/core";
import { icons, Phone, Mail, Printer, MapPin, ArrowUpRight, UploadCloud } from "lucide-react";
import {
  type Page,
  type Block,
  type LinkPagesMap,
  type FeaturedBanner,
  type ContactInfo,
  getFeaturedBanners,
  getContactInfo,
  getSystemPageSlug,
} from "@/lib/api";
import { useLocaleConfig, useStrings } from "@/lib/locale";
import "@/styles/pages/about.scss";

// ─── about-us block data ──────────────────────────────────────────────────────

interface AboutUsData {
  altTitle: string;
  heroImage: { cdnUrl?: string } | null;
  subtitle: string;
  description: string;
  btn1Link: Record<string, unknown> | null;
  btn2Link: Record<string, unknown> | null;
  section2Title: string;
  section3Title: string;
  section3Subtitle: string;
}

function readBlock(page: Page): AboutUsData {
  const block = (page.blocks ?? []).find((b: Block) => b.type === "about-us");
  const d = (block?.data ?? {}) as Partial<AboutUsData>;
  return {
    altTitle: d.altTitle ?? "",
    heroImage: (d.heroImage as { cdnUrl?: string }) ?? null,
    subtitle: d.subtitle ?? "",
    description: d.description ?? "",
    btn1Link: (d.btn1Link as Record<string, unknown>) ?? null,
    btn2Link: (d.btn2Link as Record<string, unknown>) ?? null,
    section2Title: d.section2Title ?? "",
    section3Title: d.section3Title ?? "",
    section3Subtitle: d.section3Subtitle ?? "",
  };
}

// Smooth-scroll a same-page anchor (#id) into view.
function scrollToAnchor(hash: string) {
  const id = hash.replace(/^#/, "");
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Settings stores either a bare URL or the full Google Maps "Embed a map"
// <iframe …> snippet. Pull the embeddable URL out of the snippet; pass a bare
// URL through unchanged. (Putting the whole <iframe> string into an iframe's
// src is what made the modal load our own site.)
export function extractMapEmbedSrc(value: string): string {
  const m = value.match(/src\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : value.trim();
}

// A maps link the native app can deep-link to. Prefer a place search built from
// the address (reliable on iOS/Android); fall back to the embed src.
export function mapsAppLink(address: string, embedSrc: string): string {
  if (address.trim()) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return embedSrc;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// Resolve a CMS LinkData object → a navigable href.
function resolveHref(
  link: Record<string, unknown> | null,
  locale: string,
  linkPages: LinkPagesMap
): { href: string; internal: boolean; newTab: boolean } | null {
  if (!link) return null;
  const linkType = link.linkType as string;
  if (!linkType) return null;
  const newTab = Boolean(link.openInNewTab);

  if (linkType === "page") {
    const pageId = (link.pageId as string) || "";
    const resolved = pageId ? linkPages[pageId]?.[locale] : null;
    const path = resolved?.path && resolved.path.length ? resolved.path.join("/") : resolved?.slug;
    const href = resolved?.active && path ? `/${locale}/${path}` : `/${locale}/`;
    return { href, internal: true, newTab };
  }
  if (linkType === "remote") return { href: (link.url as string) || "#", internal: false, newTab };
  if (linkType === "email") {
    const e = (link.email as string) || "";
    const s = (link.emailSubject as string) || "";
    return { href: `mailto:${e}${s ? `?subject=${encodeURIComponent(s)}` : ""}`, internal: false, newTab };
  }
  if (linkType === "file") return { href: (link.fileUrl as string) || "#", internal: false, newTab };
  return null;
}

// Pick the active-locale value out of a { [locale]: string } map, falling back
// to the default locale, then to any non-empty value.
function pickLocalized(map: Record<string, string> | undefined, locale: string, defaultLocale: string): string {
  if (!map) return "";
  return map[locale] || map[defaultLocale] || Object.values(map).find((v) => v && v.trim()) || "";
}

const IS_MOBILE =
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// `.ln-btn` CTA from a CMS LinkData (with a fallback label + href). A "#anchor"
// href smooth-scrolls in-page rather than navigating.
function LnCta({
  link,
  fallbackLabel,
  fallbackHref,
  variant,
  locale,
  linkPages,
}: {
  link: Record<string, unknown> | null;
  fallbackLabel: string;
  fallbackHref: string;
  variant: "primary" | "ghost";
  locale: string;
  linkPages: LinkPagesMap;
}) {
  const resolved = resolveHref(link, locale, linkPages);
  const href = resolved?.href ?? fallbackHref;
  const label = (link?.linkText as string) || fallbackLabel;
  const cls = `ln-btn ln-btn--${variant} ln-btn--lg`;

  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls} onClick={(e) => { e.preventDefault(); scrollToAnchor(href); }}>
        {label}
      </a>
    );
  }
  const internal = resolved ? resolved.internal : href.startsWith("/");
  const newTab = resolved?.newTab ?? false;
  if (internal && !newTab) return <Link to={href} className={cls}>{label}</Link>;
  return (
    <a href={href} className={cls} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>
      {label}
    </a>
  );
}

// ─── Featured banners (reuses the homepage .a-banner vocabulary) ─────────────

function FeaturedBanners({ banners, locale, defaultLocale }: { banners: FeaturedBanner[]; locale: string; defaultLocale: string }) {
  if (!banners.length) return null;
  return (
    <div className="a-banners">
      {banners.map((b, i) => {
        const Icon = b.icon ? (icons as Record<string, typeof icons.Truck>)[b.icon] : null;
        const title = pickLocalized(b.title, locale, defaultLocale);
        const content = pickLocalized(b.content, locale, defaultLocale);
        return (
          <div className="a-banner" key={i}>
            <div className="a-banner__ico">{Icon && <Icon aria-hidden="true" />}</div>
            {title && <h3>{title}</h3>}
            {content && <p>{content}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Static inquiry form (UI only) ────────────────────────────────────────────

function InquiryForm() {
  const { t } = useStrings();
  const [service, setService] = useState("");
  const serviceOptions = [
    t("about.form_service_opt1"),
    t("about.form_service_opt2"),
    t("about.form_service_opt3"),
    t("about.form_service_opt4"),
    t("about.form_service_opt5"),
    t("about.form_service_opt6"),
  ];
  return (
    <form className="ab-form" onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="ab-form__row">
        <div className="ab-field">
          <label>{t("about.form_fullname")}</label>
          <input className="ab-input" type="text" placeholder={t("about.form_fullname_ph")} />
        </div>
        <div className="ab-field">
          <label>{t("about.form_email")}</label>
          <input className="ab-input" type="email" placeholder={t("about.form_email_ph")} />
        </div>
      </div>
      <div className="ab-field">
        <label>{t("about.form_service")}</label>
        <select
          className={`ab-select${service === "" ? " is-placeholder" : ""}`}
          value={service}
          onChange={(e) => setService(e.currentTarget.value)}
        >
          <option value="" disabled>{t("about.form_service_ph")}</option>
          {serviceOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="ab-field">
        <label>{t("about.form_message")}</label>
        <textarea className="ab-textarea" placeholder={t("about.form_message_ph")} />
      </div>
      <div className="ab-field">
        <div className="ab-drop">
          <div className="ab-drop__ico"><UploadCloud aria-hidden="true" /></div>
          <p>{t("about.form_dropzone")}</p>
        </div>
      </div>
      <div className="ab-form__submit">
        <button type="submit" className="ln-btn ln-btn--primary ln-btn--lg">{t("about.form_submit")}</button>
      </div>
    </form>
  );
}

// ─── Contact panel (info + stylized map → real embed modal / deep-link) ───────

const PIN_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
  </svg>
);

function ContactPanel({ contact }: { contact: ContactInfo | null }) {
  const { t } = useStrings();
  const [mapOpen, setMapOpen] = useState(false);
  if (!contact) return null;

  const hasMaps = Boolean(contact.mapsUrl && contact.mapsUrl.trim());
  const embedSrc = extractMapEmbedSrc(contact.mapsUrl);
  const appLink = mapsAppLink(contact.address, embedSrc);

  function onMapClick() {
    if (!hasMaps) return;
    // On phones/tablets, hand the place link to the native maps app; on desktop
    // show the real embed in a modal.
    if (IS_MOBILE) window.open(appLink, "_blank", "noopener,noreferrer");
    else setMapOpen(true);
  }

  const rows: { k: string; icon: React.ReactNode; node: React.ReactNode }[] = [];
  if (contact.phone)
    rows.push({ k: t("about.contact_phone"), icon: <Phone aria-hidden="true" />, node: <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a> });
  if (contact.email)
    rows.push({ k: t("about.contact_email"), icon: <Mail aria-hidden="true" />, node: <a href={`mailto:${contact.email}`}>{contact.email}</a> });
  if (contact.fax)
    rows.push({ k: t("about.contact_fax"), icon: <Printer aria-hidden="true" />, node: contact.fax });
  if (contact.address)
    rows.push({ k: t("about.contact_address"), icon: <MapPin aria-hidden="true" />, node: contact.address });

  return (
    <div className="ab-panel">
      <div className="ab-panel__card">
        <ul className="ab-panel__list">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="ab-panel__ico">{r.icon}</span>
              <div>
                <div className="ab-panel__k">{r.k}</div>
                <div className="ab-panel__v">{r.node}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {hasMaps && (
        <div className="ab-map">
          <div className="ab-map__head">
            <h3>{t("about.map_title")}</h3>
            <button type="button" className="ab-map__open" onClick={onMapClick}>
              <ArrowUpRight aria-hidden="true" />
              {t("about.map_open")}
            </button>
          </div>
          <div className="ab-map__canvas" role="button" aria-label={t("about.map_title")} onClick={onMapClick}>
            <div className="ab-map__road r1" />
            <div className="ab-map__road r2" />
            <div className="ab-map__pin">{PIN_SVG}</div>
          </div>
        </div>
      )}

      <Modal opened={mapOpen} onClose={() => setMapOpen(false)} title={t("about.map_title")} size="xl" centered>
        <AspectRatio ratio={16 / 9}>
          <iframe
            title="Google Maps"
            src={embedSrc}
            style={{ border: 0, width: "100%", height: "100%", borderRadius: 8 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </AspectRatio>
        <Button
          component="a"
          href={appLink}
          target="_blank"
          rel="noopener noreferrer"
          variant="light"
          color="teal"
          mt="md"
        >
          {t("about.map_open")}
        </Button>
      </Modal>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function AboutUsView({ page, locale }: { page: Page; locale: string }) {
  const d = useMemo(() => readBlock(page), [page]);
  const { defaultLocale } = useLocaleConfig();
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };
  const linkPages = page.linkPages ?? {};

  const [banners, setBanners] = useState<FeaturedBanner[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [allProductsSlug, setAllProductsSlug] = useState("svi-proizvodi");

  useEffect(() => {
    let cancelled = false;
    void getFeaturedBanners().then((b) => !cancelled && setBanners(b));
    void getContactInfo().then((c) => !cancelled && setContact(c));
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    getSystemPageSlug("all-products", locale).then(setAllProductsSlug).catch(() => {});
  }, [locale]);

  const allProductsUrl = `/${locale}/${allProductsSlug}`;

  return (
    <div className="ab-view">
      {/* ── HERO ── */}
      <section className="ab-hero">
        <div className="ln-container">
          <div className="ab-hero__grid">
            <div>
              <span className="a-eyebrow">{tx("about.hero_eyebrow", "O nama")}</span>
              <h1>{d.altTitle || page.title}</h1>
              {d.subtitle && <p className="ab-hero__sub">{d.subtitle}</p>}
              <div className="ab-hero__cta">
                <LnCta
                  link={d.btn1Link}
                  fallbackLabel={tx("about.hero_cta_primary", "Pošaljite upit")}
                  fallbackHref="#kontakt"
                  variant="primary"
                  locale={locale}
                  linkPages={linkPages}
                />
                <LnCta
                  link={d.btn2Link}
                  fallbackLabel={tx("about.hero_cta_secondary", "Pregledaj proizvode")}
                  fallbackHref={allProductsUrl}
                  variant="ghost"
                  locale={locale}
                  linkPages={linkPages}
                />
              </div>
            </div>
            <div className="ab-hero__media">
              <div className="ab-hero__frame">
                {d.heroImage?.cdnUrl && <img className="ln-img" src={d.heroImage.cdnUrl} alt={d.altTitle || page.title} />}
              </div>
              <div className="ab-hero__tag">
                <b>{tx("about.hero_stat_value", "1800 m²")}</b>
                <span>{tx("about.hero_stat_label", "vlastiti proizvodni pogon")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY US ── */}
      <section className="a-section a-section--tint">
        <div className="ln-container">
          <div className="a-head">
            <span className="a-eyebrow">{tx("about.why_eyebrow", "Zašto Linea")}</span>
            {d.section2Title && <h2>{d.section2Title}</h2>}
            {d.description && <p>{d.description}</p>}
          </div>
          <FeaturedBanners banners={banners} locale={locale} defaultLocale={defaultLocale} />
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="a-section" id="kontakt" style={{ scrollMarginTop: 80 }}>
        <div className="ln-container">
          <div className="a-head">
            <span className="a-eyebrow">{tx("about.contact_eyebrow", "Kontakt")}</span>
            {d.section3Title && <h2>{d.section3Title}</h2>}
            {d.section3Subtitle && <p>{d.section3Subtitle}</p>}
          </div>
          <div className="ab-contact__grid">
            <InquiryForm />
            <ContactPanel contact={contact} />
          </div>
        </div>
      </section>
    </div>
  );
}
