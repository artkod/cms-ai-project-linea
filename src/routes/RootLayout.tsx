import { useEffect, useState } from "react";
import { Container } from "@mantine/core";
import { Outlet, Link, NavLink, useParams, useNavigate, useLocation } from "react-router";
import { Search, ShoppingCart, Menu as MenuIcon, X, MapPin, Mail } from "lucide-react";
import { getMenu, getSystemPageSlug, getContactInfo, type MenuItem, type ContactInfo } from "../lib/api";
import { useLocaleConfig, useStrings, PageAlternatesProvider, StringsProvider, PageLayoutProvider, usePageLayout } from "../lib/locale";
import { useCart } from "../lib/cart";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SiteModals } from "../components/SiteModals";
import { LineaLogo } from "../components/LineaLogo";
import { extractMapEmbedSrc, mapsAppLink } from "./AboutUsView";

function injectHtml(html: string, target: HTMLElement, marker: string) {
  if (!html) return;
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll("script").forEach((oldScript) => {
    const newScript = document.createElement("script");
    newScript.dataset.cmsInjection = marker;
    Array.from(oldScript.attributes).forEach((a) => newScript.setAttribute(a.name, a.value));
    newScript.textContent = oldScript.textContent;
    target.appendChild(newScript);
    oldScript.remove();
  });
  Array.from(container.childNodes).forEach((n) => {
    if (n instanceof HTMLElement) n.dataset.cmsInjection = marker;
    target.appendChild(n);
  });
}

// Linea's primary nav is single-level (no dropdowns) — render each top-level
// menu item as a flat link. External links open in a new tab; internal links
// use NavLink so the active route shows the lime underline (`.is-active`).
function PrimaryNavItem({ item, onNavigate }: { item: MenuItem; onNavigate?: () => void }) {
  const href = item.url ?? "/";
  const isExternal = item.target === "_blank" || href.startsWith("http");
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
        {item.label}
      </a>
    );
  }
  return (
    <NavLink to={href} onClick={onNavigate} className={({ isActive }) => (isActive ? "is-active" : undefined)}>
      {item.label}
    </NavLink>
  );
}

// Footer link — plain element so the dark-footer CSS (`.ln-footer__links a`)
// owns the styling rather than Mantine's <Anchor>.
function FooterLink({ item }: { item: MenuItem }) {
  const href = item.url ?? "/";
  const isExternal = item.target === "_blank" || href.startsWith("http");
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {item.label}
      </a>
    );
  }
  return <Link to={href}>{item.label}</Link>;
}

// The sticky site header: wordmark, flat primary nav, functional product
// search, a (visual-only) cart link, language switcher, and a mobile panel.
// Lives inside <StringsProvider> so it can resolve the search placeholder via
// t(). Search submit navigates to the search page with `?q=` — SearchView reads
// the query straight from the URL and renders matching product-items.
function SiteHeader({
  activeLocale,
  siteTitle,
  primaryItems,
  searchSlug,
  cartSlug,
}: {
  activeLocale: string;
  siteTitle: string;
  primaryItems: MenuItem[];
  searchSlug: string;
  cartSlug: string;
}) {
  const navigate = useNavigate();
  const { t } = useStrings();
  const { count: cartCount } = useCart();
  const [searchValue, setSearchValue] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const placeholder = t("allproducts.search_label"); // "Pretraži proizvode"

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchValue.trim();
    navigate(`/${activeLocale}/${searchSlug}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setMobileOpen(false);
  };

  const searchForm = (variant: "header" | "mobile") => (
    <form
      className={`ln-search${variant === "header" ? " ln-search--header" : ""}`}
      role="search"
      onSubmit={submitSearch}
    >
      <Search aria-hidden="true" />
      <input
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.currentTarget.value)}
        placeholder={`${placeholder}…`}
        aria-label={placeholder}
      />
    </form>
  );

  return (
    <header className="ln-header">
      <div className="ln-container ln-header__bar">
        <Link to={`/${activeLocale}/`} className="ln-wordmark" aria-label={siteTitle}>
          <LineaLogo className="ln-logo" title={siteTitle} />
        </Link>

        {/* desktop nav — flat, single level */}
        {primaryItems.length > 0 && (
          <nav aria-label="Glavna navigacija">
            <ul className="ln-nav">
              {primaryItems.map((item) => (
                <li key={item.id}>
                  <PrimaryNavItem item={item} />
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="ln-header__right">
          {searchForm("header")}

          <Link to={`/${activeLocale}/${cartSlug}`} className="ln-iconbtn" aria-label="Košarica">
            <ShoppingCart aria-hidden="true" />
            {cartCount > 0 && <span className="ln-cart-badge">{cartCount}</span>}
          </Link>

          <LanguageSwitcher />

          <button
            type="button"
            className="ln-burger"
            aria-label="Izbornik"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* mobile panel */}
      <div className={`ln-mobile${mobileOpen ? " is-open" : ""}`}>
        {searchForm("mobile")}
        {primaryItems.map((item) => (
          <PrimaryNavItem key={item.id} item={item} onNavigate={() => setMobileOpen(false)} />
        ))}
      </div>
    </header>
  );
}

// Dark deep-green footer: brand + tagline · "Stranice" (footer menu) · "Kontakt"
// (real contact values from the `contact` project-setting), then a bottom bar
// with the copyright line. Structural labels go through t() so editors can
// override them in the Strings manager, falling back to the Croatian defaults
// below until the keys are filled in.
function SiteFooter({
  activeLocale,
  siteTitle,
  tagline,
  footerItems,
  contact,
}: {
  activeLocale: string;
  siteTitle: string;
  tagline: string;
  footerItems: MenuItem[];
  contact: ContactInfo | null;
}) {
  const { t } = useStrings();
  const year = new Date().getFullYear();

  // Editor-overridable label with a Croatian default (t() returns the key
  // itself when unset, which we don't want to show as chrome copy).
  const tx = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const hasMaps = Boolean(contact?.mapsUrl && contact.mapsUrl.trim());
  const mapsHref = contact && hasMaps
    ? mapsAppLink(contact.address, extractMapEmbedSrc(contact.mapsUrl))
    : null;

  return (
    <footer className="ln-footer">
      <div className="ln-container">
        {/* Newsletter CTA — fires the same window event the global 30s auto-pop
            (SiteModals) listens for, so the modal is reachable on demand too. */}
        <div className="ln-foot-news">
          <div className="ln-foot-news__txt">
            <h3>{tx("newsletter.cta_title", "Pretplatite se na novosti")}</h3>
            <p>{tx("newsletter.cta_text", "Primajte obavijesti o novim proizvodima, akcijama i projektima — povremeno i bez spama.")}</p>
          </div>
          <button
            type="button"
            className="ln-foot-news__btn"
            onClick={() => window.dispatchEvent(new Event("linea:open-newsletter"))}
          >
            <Mail aria-hidden="true" />
            {tx("newsletter.cta_button", "Pretplatite se")}
          </button>
        </div>

        <div className="ln-footer__top">
          {/* Brand */}
          <div className="ln-footer__brand">
            <Link to={`/${activeLocale}/`} className="ln-wordmark" aria-label={siteTitle}>
              <LineaLogo className="ln-logo" title={siteTitle} />
            </Link>
            {tagline && <p className="ln-footer__tag">{tagline}</p>}
          </div>

          {/* Stranice — footer menu (dynamic, built in the CMS menu builder) */}
          {footerItems.length > 0 && (
            <div>
              <h4>{tx("footer.heading_pages", "Stranice")}</h4>
              <ul className="ln-footer__links">
                {footerItems.map((item) => (
                  <li key={item.id}>
                    <FooterLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Kontakt — real values from the `contact` project-setting */}
          {contact && (
            <div>
              <h4>{tx("footer.heading_contact", "Kontakt")}</h4>
              <div className="ln-contact">
                {contact.phone && (
                  <div>
                    <span className="ln-contact__k">{tx("footer.contact_phone", "Telefon")}</span>
                    <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>
                  </div>
                )}
                {contact.fax && (
                  <div>
                    <span className="ln-contact__k">{tx("footer.contact_fax", "Faks")}</span>
                    <span>{contact.fax}</span>
                  </div>
                )}
                {contact.email && (
                  <div>
                    <span className="ln-contact__k">{tx("footer.contact_email", "Email")}</span>
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  </div>
                )}
                {contact.address && (
                  <div>
                    <span className="ln-contact__k">{tx("footer.contact_address", "Adresa")}</span>
                    <span>{contact.address}</span>
                  </div>
                )}
                {mapsHref && (
                  <a className="ln-maplink" href={mapsHref} target="_blank" rel="noopener noreferrer">
                    <MapPin aria-hidden="true" /> {tx("footer.maps_link", "Otvori u Google kartama")}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="ln-footer__bottom">
          <span>© {year} {siteTitle}.</span>
        </div>
      </div>
    </footer>
  );
}

// Main content area. The homepage and any page that flips
// `usePageLayout().fullBleed` (e.g. the product page) render full-bleed — their
// bands span the viewport, each with its own inner `.ln-container`. Everything
// else stays inside the centered 1140px content container.
//
// IMPORTANT: we keep a SINGLE <Container> instance and only toggle its props.
// Swapping the wrapper element (bare <Outlet/> vs container-wrapped) changes the
// tree shape and remounts <Outlet/> → PageView resets to a loading state, which
// flips `fullBleed` back, which remounts again: an infinite refetch loop.
function MainArea({ activeLocale }: { activeLocale: string }) {
  const { fullBleed } = usePageLayout();
  const { pathname } = useLocation();
  const isHome = pathname === `/${activeLocale}` || pathname === `/${activeLocale}/`;
  const bleed = isHome || fullBleed;
  return (
    <main style={{ flex: 1 }}>
      <Container
        fluid={bleed}
        size={bleed ? undefined : 1140}
        px={bleed ? 0 : undefined}
        py={bleed ? 0 : "xl"}
      >
        <Outlet />
      </Container>
    </main>
  );
}

export function RootLayout() {
  const { locale } = useParams<{ locale: string }>();
  const { settings, defaultLocale, availableLocales, setActiveLocale } = useLocaleConfig();
  const activeLocale = locale ?? defaultLocale;
  const [primaryItems, setPrimaryItems] = useState<MenuItem[]>([]);
  const [footerItems, setFooterItems] = useState<MenuItem[]>([]);
  const [searchSlug, setSearchSlug] = useState("pretraga");
  const [cartSlug, setCartSlug] = useState("kosarica");
  const [contact, setContact] = useState<ContactInfo | null>(null);

  // Tell the provider which locale to use when fetching multilingual site
  // settings (siteTitle, tagline, default SEO). Per the I6 contract the
  // server flattens these to the active locale, falling back to defaultLocale.
  useEffect(() => {
    setActiveLocale(activeLocale);
  }, [activeLocale, setActiveLocale]);

  // Refetch menus + resolve the live search/cart slugs whenever the active
  // locale changes.
  useEffect(() => {
    getMenu("primary", activeLocale).then(setPrimaryItems).catch(() => setPrimaryItems([]));
    getMenu("footer", activeLocale).then(setFooterItems).catch(() => setFooterItems([]));
    getSystemPageSlug("search", activeLocale).then(setSearchSlug).catch(() => {});
    getSystemPageSlug("cart", activeLocale).then(setCartSlug).catch(() => {});
  }, [activeLocale]);

  // Contact details (footer) are a single, locale-agnostic project-setting —
  // fetch once on mount.
  useEffect(() => {
    getContactInfo().then(setContact).catch(() => setContact(null));
  }, []);

  // Settings-derived <head> bits (favicon, document title, custom HTML, html lang).
  useEffect(() => {
    if (!settings) return;
    if (settings.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = settings.faviconUrl;
    }
    // document.title is owned by useDocumentSeo (per-page title + site-default
    // fallback) in HomePage/PageView — RootLayout no longer sets it here.
    // Custom HTML is single-injection per mount — re-running with the same marker is a no-op.
    if (settings.customHeadHtml) injectHtml(settings.customHeadHtml, document.head, "head");
    if (settings.customBodyHtml) injectHtml(settings.customBodyHtml, document.body, "body");
  }, [settings]);

  // Reflect the active locale on <html lang> for accessibility & SEO.
  useEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  // Atom feed <link> tags — one per available locale for discovery tools.
  useEffect(() => {
    document.head.querySelectorAll("link[data-cms-feed='1']").forEach((el) => el.remove());
    for (const loc of availableLocales) {
      const link = document.createElement("link");
      link.rel = "alternate";
      link.type = "application/atom+xml";
      link.hreflang = loc;
      link.href = `/feed/${loc}.xml`;
      link.dataset.cmsFeed = "1";
      document.head.appendChild(link);
    }
  }, [availableLocales]);

  const siteTitle = settings?.siteTitle || "Linea";

  // The homepage and the product page render full-bleed (their bands span the
  // viewport, each with its own inner `.ln-container`); every other route stays
  // inside the 1140px content container. The product page opts in at runtime via
  // PageLayoutProvider's `fullBleed` flag, consumed by <MainArea>.
  return (
    <PageAlternatesProvider>
     <StringsProvider locale={activeLocale}>
      <PageLayoutProvider>
       <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Header */}
        <SiteHeader
          activeLocale={activeLocale}
          siteTitle={siteTitle}
          primaryItems={primaryItems}
          searchSlug={searchSlug}
          cartSlug={cartSlug}
        />

        {/* Main */}
        <MainArea activeLocale={activeLocale} />

        {/* Footer */}
        <SiteFooter
          activeLocale={activeLocale}
          siteTitle={siteTitle}
          tagline={settings?.tagline || ""}
          footerItems={footerItems}
          contact={contact}
        />

        {/* Global cookie consent + newsletter */}
        <SiteModals />
       </div>
      </PageLayoutProvider>
     </StringsProvider>
    </PageAlternatesProvider>
  );
}
