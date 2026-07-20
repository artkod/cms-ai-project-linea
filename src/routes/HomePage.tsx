import { useEffect, useMemo, useState } from "react";
import { Loader } from "@mantine/core";
import { Link, useParams } from "react-router";
import { icons, ArrowRight } from "lucide-react";
import {
  getFeaturedBanners,
  getContactInfo,
  getSystemPageSlug,
  type FeaturedBanner,
  type ContactInfo,
} from "@/lib/api";
import type { CategoryNode, ProductCard as CatalogProductCard } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { usePageAlternates, useStrings, useLocaleConfig } from "@/lib/locale";
import { useDocumentSeo } from "@/lib/seo";

// Homepage — Direction A ("Clean & Corporate"). Full-bleed alternating bands
// (RootLayout drops its container for the index route); inner content stays
// inside `.ln-container`. Marketing copy that has no CMS field flows through
// t() (seeded in project-data.seed.json) so it's editable in the Strings
// manager; the product/banner sections are wired to live CMS data.

const eurFmt = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface GroupCard {
  id: string;
  title: string;
  url: string;
  catNames: string;
  catCount: number;
  image: string | null;
}

interface ProductCard {
  id: string;
  title: string;
  categoryTitle: string;
  image: string | null;
  url: string;
  /** amount in EUR (not cents) — feeds the existing eurFmt markup. */
  price: { amount: number; from: boolean } | null;
}

export function HomePage() {
  const { locale } = useParams<{ locale: string }>();
  const { defaultLocale, settings } = useLocaleConfig();
  const activeLocale = locale ?? defaultLocale;
  const { setAlternates } = usePageAlternates();
  const { t } = useStrings();

  // Home has no per-page SEO — render the site-wide defaults (D3).
  useDocumentSeo(null, settings);

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [items, setItems] = useState<CatalogProductCard[]>([]);
  const [banners, setBanners] = useState<FeaturedBanner[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [allProductsSlug, setAllProductsSlug] = useState("svi-proizvodi");
  const [aboutSlug, setAboutSlug] = useState("o-nama");

  // Home has no per-page alternates payload — clear it so the language
  // switcher falls back to the locale root.
  useEffect(() => {
    setAlternates(null);
  }, [setAlternates, activeLocale]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      storefront.listCategories({ locale: activeLocale }),
      storefront.listProducts({ locale: activeLocale, sort: "newest", limit: 100 }).then((r) => r.data),
      getFeaturedBanners(),
      getContactInfo(),
      getSystemPageSlug("all-products", activeLocale),
      getSystemPageSlug("about-us", activeLocale),
    ])
      .then(([cats, its, bnr, ct, allSlug, abSlug]) => {
        if (!alive) return;
        setCategories(cats);
        setItems(its);
        setBanners(bnr);
        setContact(ct);
        setAllProductsSlug(allSlug);
        setAboutSlug(abSlug);
      })
      .catch(() => {
        if (!alive) return;
        setCategories([]);
        setItems([]);
        setBanners([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeLocale]);

  const allProductsUrl = `/${activeLocale}/${allProductsSlug}`;
  const aboutUrl = `/${activeLocale}/${aboutSlug}`;

  // Resolve a banner's localized field, falling back to defaultLocale.
  const loc = (m: Record<string, string> | undefined): string =>
    (m?.[activeLocale] || m?.[defaultLocale] || "").trim();

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const mains = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  // A product's MAIN category: its primary's parent (the migration made the
  // subcategory primary; main-only products keep the main itself as primary).
  const mainCatOf = (p: CatalogProductCard): CategoryNode | null => {
    const primary = p.primaryCategoryId ? catById.get(p.primaryCategoryId) : null;
    if (!primary) return null;
    return primary.parentId ? catById.get(primary.parentId) ?? null : primary;
  };

  // Group cards: one per main category. Subcategory names list + count; the
  // representative image is the first product photo found in that main category.
  const groupCards = useMemo<GroupCard[]>(() => {
    return mains.map((main) => {
      const subs = categories.filter((c) => c.parentId === main.id);
      const firstItem = items.find((it) => mainCatOf(it)?.id === main.id && it.image?.cdnUrl);
      return {
        id: main.id,
        title: main.label ?? "",
        // Open the full catalog with this main category's filter pre-applied.
        url: `/${activeLocale}/${allProductsSlug}?kategorija=${encodeURIComponent(main.slug ?? "")}`,
        catNames: subs.map((s) => s.label ?? "").filter(Boolean).join(" · "),
        catCount: subs.length,
        image: firstItem?.image?.cdnUrl ?? null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mains, categories, items, activeLocale, allProductsSlug]);

  // Up to 4 newest products for the homepage rail. URL is the flat
  // `/{locale}/{all-products}/{slug}`; category label = the primary category.
  const featured = useMemo<ProductCard[]>(() => {
    return items.slice(0, 4).map((p) => {
      const primary = p.primaryCategoryId ? catById.get(p.primaryCategoryId) : null;
      return {
        id: p.id,
        title: p.name,
        categoryTitle: primary?.label ?? "",
        image: p.image?.cdnUrl ?? null,
        url: `/${activeLocale}/${allProductsSlug}/${p.slug}`,
        price: p.price > 0 ? { amount: p.price / 100, from: p.variantCount > 1 && p.priceMax > p.price } : null,
      };
    });
  }, [items, catById, activeLocale, allProductsSlug]);

  const trustImage = featured.find((p) => p.image)?.image ?? null;
  const phoneTel = contact?.phone ? contact.phone.replace(/[^+\d]/g, "") : "";

  if (loading) {
    return (
      <div className="ln-loading">
        <Loader color="var(--brand)" />
      </div>
    );
  }

  return (
    <div className="ln-home">
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="a-hero">
        <div className="ln-container">
          <span className="a-eyebrow">{t("home.hero_eyebrow")}</span>
          <h1>
            {t("home.hero_title_pre")}
            <em>{t("home.hero_title_em")}</em>
            {t("home.hero_title_post")}
          </h1>
          <p>{t("home.hero_sub")}</p>
          <div className="a-hero__cta">
            <Link className="ln-btn ln-btn--primary ln-btn--lg" to={allProductsUrl}>
              {t("home.hero_cta_primary")}
            </Link>
            <Link className="ln-btn ln-btn--ghost ln-btn--lg" to={aboutUrl}>
              {t("home.hero_cta_secondary")}
            </Link>
          </div>
          <div className="a-hero__stats">
            <div>
              <b>{mains.length}</b>
              <span>{t("home.stat_groups_label")}</span>
            </div>
            <div>
              <b>{categories.filter((c) => c.parentId).length}</b>
              <span>{t("home.stat_categories_label")}</span>
            </div>
            <div>
              <b>{t("home.stat_facility_value")}</b>
              <span>{t("home.stat_facility_label")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT GROUPS ────────────────────────────────────── */}
      <section className="a-section">
        <div className="ln-container">
          <div className="a-head">
            <span className="a-eyebrow">{t("home.groups_eyebrow")}</span>
            <h2>{t("home.groups_title")}</h2>
            <p>{t("home.groups_subtitle")}</p>
          </div>
          <div className="a-groups">
            {groupCards.map((g) => (
              <Link key={g.id} to={g.url} className="a-group">
                <div className="a-thumb">
                  {g.image && <img className="ln-img" src={g.image + "?width=400"} alt={g.title} loading="lazy" />}
                </div>
                <div className="a-group__body">
                  <h3>{g.title}</h3>
                  {g.catNames && <p className="a-group__cats">{g.catNames}</p>}
                  <div className="a-group__foot">
                    <span className="a-group__count">
                      {g.catCount} {t("home.groups_count_suffix")}
                    </span>
                    <ArrowRight className="ln-arrow" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            ))}
            {/* Fixed "Cijeli katalog" CTA tile */}
            <Link to={allProductsUrl} className="a-group a-group--cta">
              <div className="a-group__body">
                <h3>{t("home.groups_cta_title")}</h3>
                <p className="a-group__cats">{t("home.groups_cta_desc")}</p>
                <div className="a-group__foot">
                  <span className="a-group__count">
                    {items.length} {t("home.groups_cta_count_suffix")}
                  </span>
                  <ArrowRight className="ln-arrow" aria-hidden="true" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURED BANNERS ──────────────────────────────────── */}
      {banners.length > 0 && (
        <section className="a-section a-section--tint">
          <div className="ln-container">
            <div className="a-head">
              <span className="a-eyebrow">{t("home.banners_eyebrow")}</span>
              <h2>{t("home.banners_title")}</h2>
            </div>
            <div className="a-banners">
              {banners.map((b, i) => {
                const Icon = b.icon ? (icons as Record<string, typeof icons.Truck>)[b.icon] : null;
                return (
                  <div className="a-banner" key={i}>
                    <div className="a-banner__ico">{Icon && <Icon aria-hidden="true" />}</div>
                    <h3>{loc(b.title)}</h3>
                    <p>{loc(b.content)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── TRUST STRIP ───────────────────────────────────────── */}
      <section className="a-section">
        <div className="ln-container">
          <div className="a-trust">
            <div>
              <span className="a-eyebrow">{t("home.trust_eyebrow")}</span>
              <h2>{t("home.trust_title")}</h2>
              <ul className="a-trust__list">
                {[1, 2, 3].map((n) => (
                  <li key={n}>
                    <span className="n">{`0${n}`}</span>
                    <div>
                      <b>{t(`home.trust_${n}_title`)}</b>
                      <span>{t(`home.trust_${n}_text`)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="a-trust__media">
              <div className="a-thumb">
                {trustImage && <img className="ln-img" src={trustImage + "?width=600"} alt="" loading="lazy" />}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ─────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="a-section a-section--tint">
          <div className="ln-container">
            <div
              className="a-head"
              style={{ maxWidth: "none", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}
            >
              <div>
                <span className="a-eyebrow">{t("home.featured_eyebrow")}</span>
                <h2>{t("home.featured_title")}</h2>
              </div>
              <Link to={allProductsUrl} className="ln-btn ln-btn--ghost">
                {t("home.featured_all_btn")}
              </Link>
            </div>
            <div className="a-products">
              {featured.map((p) => (
                <Link key={p.id} to={p.url} className="a-prod">
                  <div className="a-thumb">
                    {p.image && <img className="ln-img" src={p.image + "?width=300"} alt={p.title} loading="lazy" />}
                  </div>
                  <div className="a-prod__b">
                    {p.categoryTitle && <div className="a-prod__cat">{p.categoryTitle}</div>}
                    <h3>{p.title}</h3>
                    {p.price ? (
                      <div className="a-prod__price">
                        {p.price.from ? `${t("allproducts.price_from")} ` : ""}
                        {eurFmt.format(p.price.amount)} <small>{t("home.price_vat")}</small>
                      </div>
                    ) : (
                      <div className="a-prod__price a-prod__price--upit">{t("allproducts.price_inquiry")}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT CTA BAND ──────────────────────────────────── */}
      <section className="a-section">
        <div className="ln-container">
          <div className="a-contact">
            <h2>{t("home.contact_title")}</h2>
            <p>{t("home.contact_text")}</p>
            <div className="a-contact__cta">
              <Link className="ln-btn ln-btn--primary ln-btn--lg" to={aboutUrl}>
                {t("home.contact_cta_primary")}
              </Link>
              {contact?.phone && (
                <a className="ln-btn ln-btn--ghost ln-btn--lg" href={`tel:${phoneTel}`}>
                  {contact.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
