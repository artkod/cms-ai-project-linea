import { useEffect } from "react";
import type { SiteSettings } from "./api";

// Per-page SEO. Each field is optional; whatever is blank falls back to the
// site-wide defaults from Settings → SEO Defaults (D3). The fallback chain is:
//   title       → metaTitle → title → defaultMetaTitle → siteTitle
//   description → metaDescription → defaultMetaDescription
//   og:image    → ogImageUrl → defaultOgImageUrl
export interface PageSeo {
  /** The page's display title (nav/H1) — used when no explicit metaTitle is set. */
  title?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  canonicalUrl?: string | null;
  noindex?: boolean | null;
}

// All managed nodes carry data-cms-seo="1" so we only ever touch our own tags
// (never the static ones authored in index.html) and can update them in place.
function upsertMeta(attr: "name" | "property", key: string, content: string | null | undefined) {
  const selector = `meta[${attr}="${key}"][data-cms-seo="1"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.dataset.cmsSeo = "1";
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string | null | undefined) {
  const selector = `link[rel="${rel}"][data-cms-seo="1"]`;
  let el = document.head.querySelector<HTMLLinkElement>(selector);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    el.dataset.cmsSeo = "1";
    document.head.appendChild(el);
  }
  el.href = href;
}

const s = (v: string | null | undefined) => (v ?? "").trim();

/**
 * Sync the document head (title, description, Open Graph, Twitter card,
 * canonical, robots) to the current page, falling back to the site-wide SEO
 * defaults for any field the page leaves blank. Pass `page = null` on routes
 * with no per-page SEO (e.g. the homepage) to render pure site defaults.
 */
export function useDocumentSeo(page: PageSeo | null, settings: SiteSettings | null): void {
  const siteTitle = s(settings?.siteTitle);
  const metaTitle =
    s(page?.metaTitle) || s(page?.title) || s(settings?.defaultMetaTitle) || siteTitle;
  const description = s(page?.metaDescription) || s(settings?.defaultMetaDescription);
  const ogImage = s(page?.ogImageUrl) || s(settings?.defaultOgImageUrl);
  // Canonical strips query/hash (e.g. ?previewToken, ?kategorija) unless the
  // editor pinned an explicit canonical URL on the page.
  const canonical =
    s(page?.canonicalUrl) || `${window.location.origin}${window.location.pathname}`;
  const noindex = page?.noindex === true;

  useEffect(() => {
    if (metaTitle) document.title = metaTitle;

    upsertMeta("name", "description", description);

    // Open Graph
    upsertMeta("property", "og:title", metaTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", siteTitle || null);

    // Twitter card
    upsertMeta("name", "twitter:card", ogImage ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", metaTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", ogImage || null);

    upsertLink("canonical", canonical);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : null);
  }, [metaTitle, description, ogImage, canonical, noindex, siteTitle]);
}
