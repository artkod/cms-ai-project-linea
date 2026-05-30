const API_URL = import.meta.env.VITE_CMS_API_URL || "http://localhost:3001";
const PROJECT_SLUG = "project-linea";

const cmsHeaders: Record<string, string> = { "X-Project-Slug": PROJECT_SLUG };

export interface Block {
  id: string;
  type: string;
  data: Record<string, unknown>;
  sortOrder: number;
}

export interface Translation {
  title: string;
  slug: string;
  active: boolean;
  typeData: Record<string, unknown>;
  blocks: Block[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean;
}

export interface Alternates {
  [locale: string]: { active: boolean; slug: string };
}

export interface LinkPagesMap {
  [pageId: string]: { [locale: string]: { active: boolean; slug: string; title: string } };
}

// Breadcrumb chain: root → immediate parent. Present on /by-slug responses.
// Each entry exposes every locale so the frontend can fall back when the
// requested locale's translation is inactive.
export interface AncestorEntry {
  id: string;
  type: string;
  locales: Record<string, { active: boolean; slug: string; title: string }>;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  type: string;
  typeData: Record<string, unknown>;
  parentId: string | null;
  parentTitle?: string | null;
  createdAt: string;
  updatedAt: string;
  blocks?: Block[];
  // Locale-aware fields (present on /by-slug responses)
  locale?: string;
  alternates?: Alternates;
  linkPages?: LinkPagesMap;
  ancestors?: AncestorEntry[];
  translations?: Record<string, Translation>;
}

export async function getPages(params?: { type?: string; parentId?: string | null; locale?: string }): Promise<Page[]> {
  const qs = new URLSearchParams({ status: "published", limit: "100" });
  if (params?.type) qs.set("type", params.type);
  if (params?.parentId === null) qs.set("parentId", "root");
  else if (params?.parentId) qs.set("parentId", params.parentId);
  if (params?.locale) qs.set("locale", params.locale);

  const res = await fetch(`${API_URL}/api/pages?${qs}`, { headers: cmsHeaders });
  if (!res.ok) throw new Error("Failed to fetch pages");
  const body = await res.json();
  const data: Page[] = body.data ?? body;
  // The API's `?locale=` query param only steers free-text search and
  // parentTitle resolution server-side — the returned flat fields stay
  // pinned to defaultLocale. So we (a) drop any page whose translation
  // in the requested locale is inactive, and (b) promote that translation
  // into the flat fields so the rest of the frontend can read `page.title`
  // / `page.slug` without locale awareness.
  if (params?.locale) {
    const loc = params.locale;
    return data
      .filter((p) => p.translations?.[loc]?.active === true)
      .map((p) => {
        const t = p.translations![loc];
        return {
          ...p,
          title: t.title,
          slug: t.slug,
          typeData: (t.typeData ?? {}) as Record<string, unknown>,
          blocks: t.blocks ?? [],
        };
      });
  }
  return data;
}

export async function getPageBySlug(locale: string, slug: string, previewToken?: string): Promise<Page | null> {
  const headers: Record<string, string> = { ...cmsHeaders };
  if (previewToken) headers["X-Preview-Token"] = previewToken;
  const res = await fetch(
    `${API_URL}/api/pages/by-slug/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`,
    { headers }
  );
  if (!res.ok) return null;
  const data = await res.json();
  // The API mirrors flat fields from defaultLocale for legacy clients. Promote
  // the requested locale's translation into the flat fields so consumers can
  // read `page.title` / `page.blocks` / `page.typeData` without thinking about
  // locales.
  const t = data?.translations?.[locale];
  if (t) {
    data.title = t.title;
    data.slug = t.slug;
    data.blocks = t.blocks ?? [];
    data.typeData = t.typeData ?? {};
    data.metaTitle = t.metaTitle ?? null;
    data.metaDescription = t.metaDescription ?? null;
    data.ogImageUrl = t.ogImageUrl ?? null;
    data.canonicalUrl = t.canonicalUrl ?? null;
    data.noindex = t.noindex ?? false;
  }
  return data;
}

export interface MenuItem {
  id: string;
  label: string;
  url?: string;
  pageId?: string;
  target?: "_self" | "_blank";
  children?: MenuItem[];
}

export async function getMenu(name: string, locale?: string): Promise<MenuItem[]> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const res = await fetch(`${API_URL}/api/menus/${encodeURIComponent(name)}${qs}`, { headers: cmsHeaders });
  if (!res.ok) return [];
  const body = await res.json();
  return body.items ?? [];
}

export interface SiteSettings {
  siteTitle: string;
  tagline: string;
  faviconUrl: string | null;
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  defaultOgImageUrl: string;
  analyticsId: string;
  customHeadHtml: string;
  customBodyHtml: string;
  robotsTxt: string;
  defaultLocale: string;
  availableLocales: string[];
}

export async function getSiteSettings(locale?: string): Promise<SiteSettings | null> {
  const qs = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  const res = await fetch(`${API_URL}/api/settings${qs}`, { headers: cmsHeaders });
  if (!res.ok) return null;
  return res.json();
}

/** Returns { key: value } map of frontend translation strings for the given locale.
 *  Bypasses the HTTP cache so editor saves are visible on the next StringsProvider
 *  fetch (which happens on mount + on every active-locale change). */
export async function getStrings(locale: string): Promise<Record<string, string>> {
  const res = await fetch(
    `${API_URL}/api/strings?locale=${encodeURIComponent(locale)}`,
    { headers: cmsHeaders, cache: "no-store" }
  );
  if (!res.ok) return {};
  return res.json();
}
