import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FileText, Download, Star } from "lucide-react";
import { getSystemPageSlug, type Page, type Block, type LinkPagesMap } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import "@/styles/pages/catalogues.scss";

// ─── catalogues block data ──────────────────────────────────────────────────

interface MediaRef {
  mediaId?: string;
  cdnUrl?: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

interface CatalogueDoc {
  id: string;
  title: string;
  file: MediaRef | null;
}

interface CataloguesData {
  subtitle: string;
  documents: CatalogueDoc[];
  contactLink: Record<string, unknown> | null;
  coverImages: MediaRef[];
}

function readBlock(page: Page): CataloguesData {
  const block = (page.blocks ?? []).find((b: Block) => b.type === "catalogues");
  const d = (block?.data ?? {}) as Partial<CataloguesData>;
  return {
    subtitle: d.subtitle ?? "",
    documents: Array.isArray(d.documents) ? (d.documents as CatalogueDoc[]) : [],
    contactLink: (d.contactLink as Record<string, unknown>) ?? null,
    coverImages: Array.isArray(d.coverImages) ? (d.coverImages as MediaRef[]) : [],
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// Resolve a CMS LinkData object → a navigable href (mirrors AboutUsView).
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

function formatSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Short uppercase type label from the MIME type (or filename extension).
function typeLabel(file: MediaRef | null): string {
  if (!file) return "FILE";
  if (file.mimeType === "application/pdf") return "PDF";
  const fromName = file.name?.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fromName) return fromName.toUpperCase();
  const sub = file.mimeType?.split("/")[1];
  return sub ? sub.toUpperCase() : "FILE";
}

// ─── small pieces ──────────────────────────────────────────────────────────

function TypeChip({ file }: { file: MediaRef | null }) {
  return (
    <span className="ct-type">
      <FileText aria-hidden="true" />
      {typeLabel(file)}
    </span>
  );
}

function DownloadBtn({ file, label, large }: { file: MediaRef | null; label: string; large?: boolean }) {
  if (!file?.cdnUrl) return null;
  return (
    <a
      href={file.cdnUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`ln-btn ln-btn--primary${large ? " ln-btn--lg" : ""}`}
    >
      <Download className="dlico" aria-hidden="true" />
      {label}
    </a>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function CataloguesView({ page, locale }: { page: Page; locale: string }) {
  const d = useMemo(() => readBlock(page), [page]);
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };
  const linkPages = page.linkPages ?? {};

  // CTA: the editor's contact link if set, else fall back to About → #kontakt.
  const [aboutSlug, setAboutSlug] = useState("o-nama");
  useEffect(() => {
    getSystemPageSlug("about-us", locale).then(setAboutSlug).catch(() => {});
  }, [locale]);
  const resolvedCta = resolveHref(d.contactLink, locale, linkPages);
  const cta = resolvedCta ?? { href: `/${locale}/${aboutSlug}#kontakt`, internal: true, newTab: false };
  const ctaLabel = t("catalogues.cta_button");

  // Cover photo for document i — rotate through the seeded placeholder pool.
  const coverFor = (i: number): string | undefined => {
    if (!d.coverImages.length) return undefined;
    return d.coverImages[i % d.coverImages.length]?.cdnUrl;
  };

  const [featured, ...rest] = d.documents;
  const downloadLabel = t("catalogues.download");

  return (
    <div className="ct-view">
      {/* PAGE HEAD */}
      <section className="ct-head">
        <div className="ln-container">
          <span className="ct-eyebrow">{tx("catalogues.eyebrow", "Dokumenti za preuzimanje")}</span>
          <h1>{page.title}</h1>
          <p>{d.subtitle || tx("catalogues.intro", "Preuzmite kataloge proizvoda, cjenike i tehničke specifikacije. Sve datoteke otvaraju se u novoj kartici.")}</p>
        </div>
      </section>

      {/* DOCUMENTS */}
      <section className="ct-body">
        <div className="ln-container">
          {d.documents.length === 0 ? (
            <div className="ct-empty">
              <div className="ct-empty__ico"><FileText aria-hidden="true" /></div>
              <p>{t("catalogues.empty")}</p>
            </div>
          ) : (
            <>
              {featured && (
                <article className="ct-featured">
                  <div className="ct-featured__media">
                    {coverFor(0) && <img className="ln-img" src={coverFor(0)} alt="" loading="lazy" />}
                    <span className="ct-featured__badge">
                      <Star aria-hidden="true" />
                      {tx("catalogues.featured_badge", "Izdvojeno")}
                    </span>
                  </div>
                  <div className="ct-featured__b">
                    <TypeChip file={featured.file} />
                    <h2>{featured.title || featured.file?.name}</h2>
                    <div className="ct-meta">
                      {typeLabel(featured.file)}
                      {formatSize(featured.file?.size) && (
                        <>
                          <span className="dot" />
                          {formatSize(featured.file?.size)}
                        </>
                      )}
                    </div>
                    <DownloadBtn file={featured.file} label={downloadLabel} large />
                  </div>
                </article>
              )}

              {rest.length > 0 && (
                <div className="ct-grid">
                  {rest.map((doc, i) => (
                    <article className="ct-card" key={doc.id}>
                      <div className="ct-card__media">
                        {coverFor(i + 1) && <img className="ln-img" src={coverFor(i + 1)} alt="" loading="lazy" />}
                        <span className="ct-card__fileicon"><FileText aria-hidden="true" /></span>
                      </div>
                      <div className="ct-card__b">
                        <h3>{doc.title || doc.file?.name}</h3>
                        <div className="ct-meta">
                          <TypeChip file={doc.file} />
                          {formatSize(doc.file?.size) && (
                            <>
                              <span className="dot" />
                              {formatSize(doc.file?.size)}
                            </>
                          )}
                        </div>
                        <div className="ct-card__dl">
                          <DownloadBtn file={doc.file} label={downloadLabel} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* CONTACT CTA */}
      <section className="ct-cta-sec">
        <div className="ln-container">
          <div className="ct-cta">
            <h2>{t("catalogues.cta_heading")}</h2>
            <p>{t("catalogues.cta_text")}</p>
            {cta.internal && !cta.newTab ? (
              <Link to={cta.href} className="ln-btn ln-btn--primary ln-btn--lg">{ctaLabel}</Link>
            ) : (
              <a
                href={cta.href}
                target={cta.newTab ? "_blank" : undefined}
                rel={cta.newTab ? "noopener noreferrer" : undefined}
                className="ln-btn ln-btn--primary ln-btn--lg"
              >
                {ctaLabel}
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
