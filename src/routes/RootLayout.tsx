import { useEffect, useState } from "react";
import { Container } from "@mantine/core";
import { Outlet, Link, NavLink, useParams, useNavigate, useLocation } from "react-router";
import { Search, ShoppingCart, Menu as MenuIcon, X, MapPin } from "lucide-react";
import { getMenu, getSystemPageSlug, getContactInfo, type MenuItem, type ContactInfo } from "../lib/api";
import { useLocaleConfig, useStrings, PageAlternatesProvider, StringsProvider } from "../lib/locale";
import { LanguageSwitcher } from "./LanguageSwitcher";
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
        <Link to={`/${activeLocale}/`} className="ln-wordmark">
          <span className="ln-dot" /> {siteTitle}
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
            <span className="ln-cart-badge">0</span>
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
        <div className="ln-footer__top">
          {/* Brand */}
          <div className="ln-footer__brand">
            <Link to={`/${activeLocale}/`} className="ln-wordmark">
              <span className="ln-dot" /> {siteTitle}
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
    if (settings.siteTitle) document.title = settings.siteTitle;
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

  // The homepage renders full-bleed (its alternating bands span the viewport,
  // each with its own inner `.ln-container`). Every other route stays inside
  // the 1140px content container.
  const { pathname } = useLocation();
  const isHome = pathname === `/${activeLocale}` || pathname === `/${activeLocale}/`;

  return (
    <PageAlternatesProvider>
     <StringsProvider locale={activeLocale}>
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
        <main style={{ flex: 1 }}>
          {isHome ? (
            <Outlet />
          ) : (
            <Container size={1140} py="xl">
              <Outlet />
            </Container>
          )}
        </main>

        {/* Footer */}
        <SiteFooter
          activeLocale={activeLocale}
          siteTitle={siteTitle}
          tagline={settings?.tagline || ""}
          footerItems={footerItems}
          contact={contact}
        />
      </div>
     </StringsProvider>
    </PageAlternatesProvider>
  );
}
