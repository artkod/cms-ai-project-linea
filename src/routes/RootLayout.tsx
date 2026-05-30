import { useEffect, useState } from "react";
import { Container, Title, Anchor, Group, Text } from "@mantine/core";
import { Outlet, Link, useLocation, useParams } from "react-router";
import { getMenu, type MenuItem } from "../lib/api";
import { useLocaleConfig, PageAlternatesProvider, StringsProvider } from "../lib/locale";
import { LanguageSwitcher } from "./LanguageSwitcher";
import "../nav.css";

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

function CascadeNavItem({ item, depth = 0 }: { item: MenuItem; depth?: number }) {
  const location = useLocation();
  const href = item.url ?? "/";
  const isExternal = item.target === "_blank" || href.startsWith("http");
  const isActive = !isExternal && location.pathname === href;
  const hasChildren = (item.children?.length ?? 0) > 0;

  const className = `cms-nav-link${isActive ? " active" : ""}`;

  const label = (
    <>
      {item.label}
      {hasChildren && (
        <span className="cms-nav-arrow">{depth === 0 ? "▾" : "›"}</span>
      )}
    </>
  );

  const link = isExternal ? (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
  ) : (
    <Link className={className} to={href}>{label}</Link>
  );

  return (
    <li className={depth === 0 ? "cms-nav-item" : "cms-nav-child"}>
      {link}
      {hasChildren && (
        <ul className={depth === 0 ? "cms-nav-dropdown" : "cms-nav-sub"}>
          {item.children!.map((child) => (
            <CascadeNavItem key={child.id} item={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function FooterLink({ item }: { item: MenuItem }) {
  const href = item.url ?? "/";
  const isExternal = item.target === "_blank" || href.startsWith("http");
  return (
    <Anchor
      component={isExternal ? "a" : (Link as any)}
      {...(isExternal ? { href, target: "_blank", rel: "noopener noreferrer" } : { to: href })}
      size="sm"
      c="dimmed"
      underline="hover"
    >
      {item.label}
    </Anchor>
  );
}

export function RootLayout() {
  const { locale } = useParams<{ locale: string }>();
  const { settings, defaultLocale, availableLocales, setActiveLocale } = useLocaleConfig();
  const activeLocale = locale ?? defaultLocale;
  const [primaryItems, setPrimaryItems] = useState<MenuItem[]>([]);
  const [footerItems, setFooterItems] = useState<MenuItem[]>([]);

  // Tell the provider which locale to use when fetching multilingual site
  // settings (siteTitle, tagline, default SEO). Per the I6 contract the
  // server flattens these to the active locale, falling back to defaultLocale.
  useEffect(() => {
    setActiveLocale(activeLocale);
  }, [activeLocale, setActiveLocale]);

  // Refetch menus whenever the active locale changes.
  useEffect(() => {
    getMenu("primary", activeLocale).then(setPrimaryItems).catch(() => setPrimaryItems([]));
    getMenu("footer", activeLocale).then(setFooterItems).catch(() => setFooterItems([]));
  }, [activeLocale]);

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
  const year = new Date().getFullYear();

  return (
    <PageAlternatesProvider>
     <StringsProvider locale={activeLocale}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Header */}
        <header style={{ borderBottom: "1px solid #e9ecef", background: "#fff", position: "sticky", top: 0, zIndex: 200 }}>
          <Container size={1140}>
            <Group h={60} justify="space-between" align="center">
              <Anchor component={Link as any} to={`/${activeLocale}/`} underline="never" c="dark">
                <Title order={4} style={{ letterSpacing: "-0.01em" }}>{siteTitle}</Title>
              </Anchor>
              <Group gap="md" align="center">
                {primaryItems.length > 0 && (
                  <nav>
                    <ul className="cms-nav">
                      {primaryItems.map((item) => (
                        <CascadeNavItem key={item.id} item={item} />
                      ))}
                    </ul>
                  </nav>
                )}
                <LanguageSwitcher />
              </Group>
            </Group>
          </Container>
        </header>

        {/* Main */}
        <main style={{ flex: 1 }}>
          <Container size={1140} py="xl">
            <Outlet />
          </Container>
        </main>

        {/* Footer */}
        <footer style={{ borderTop: "1px solid #e9ecef", background: "#f8f9fa", padding: "32px 0 24px" }}>
          <Container size={1140}>
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl" mb="md">
              <div>
                <Text size="sm" fw={600} mb={2}>{siteTitle}</Text>
                {settings?.tagline && <Text size="xs" c="dimmed">{settings.tagline}</Text>}
              </div>
              {footerItems.length > 0 && (
                <Group gap="lg">
                  {footerItems.map((item) => (
                    <FooterLink key={item.id} item={item} />
                  ))}
                </Group>
              )}
            </Group>
            <Text size="xs" c="dimmed">© {year} {siteTitle}. Content managed by cms-ai-core.</Text>
          </Container>
        </footer>
      </div>
     </StringsProvider>
    </PageAlternatesProvider>
  );
}
