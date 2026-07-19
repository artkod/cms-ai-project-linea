import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { notifications } from "@mantine/notifications";
import { useMediaQuery } from "@mantine/hooks";
import { Check, ChevronDown, Link2, Mail, Share2, ShoppingCart, Truck } from "lucide-react";
import type { CatalogProduct, CatalogVariant, CategoryNode, ProductCard } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { getSystemPageSlug } from "@/lib/api";
import { useStrings, useLocaleConfig, usePageAlternates } from "@/lib/locale";
import { useDocumentSeo } from "@/lib/seo";
import { useCart } from "@/lib/cart";
import { eurCents } from "@/lib/pricing";
import { tiptapToHtml } from "@/lib/tiptapRenderer";
import "@/styles/pages/product.scss";

// Commerce product page (replaces the legacy page-based ProductItemView; same
// `.pi-*` markup/design). The product arrives via the by-slug resolver's
// `kind:"product"` payload — options render as the familiar selects, the price
// comes from the MATCHED VARIANT (each combination has its own price), and a
// 0-cent price renders as "Na upit". Everything is inquiry-only (purchasable
// false) so the cart CTA feeds the server cart that checks out as a quote.

interface TabItem {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
}

// The product body is Mixed Content; the migration stored the plain-text
// description as TEXT widget(s) and the legacy info tabs as ONE accordion
// widget — unpack both across all sections.
interface ProductBody {
  /** TipTap docs of the description text widgets (the "O proizvodu" section). */
  about: Record<string, unknown>[];
  tabs: TabItem[];
}

function extractBody(blocks: CatalogProduct["blocks"]): ProductBody {
  const about: Record<string, unknown>[] = [];
  const tabs: TabItem[] = [];
  for (const block of blocks ?? []) {
    if (block.type !== "mixed-content") continue;
    const columns = (block.data?.columns ?? []) as Array<{
      widgets?: Array<{ type: string; data?: { items?: TabItem[]; json?: Record<string, unknown> } }>;
    }>;
    for (const col of columns) {
      for (const w of col.widgets ?? []) {
        if (w.type === "accordion") {
          for (const item of w.data?.items ?? []) {
            if (item && item.id) tabs.push(item);
          }
        } else if (w.type === "text" && w.data?.json) {
          about.push(w.data.json);
        }
      }
    }
  }
  return { about, tabs };
}

interface SelectOption {
  value: string;
  label: string;
}

function ConfigField({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  helper,
}: {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div className={`pi-field${disabled ? " is-locked" : ""}`}>
      <label className="pi-field__lab">{label}</label>
      <select
        className="pi-select"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {disabled && helper && <p className="pi-field__help">{helper}</p>}
    </div>
  );
}

export function CommerceProductView({ product }: { product: CatalogProduct }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale, settings } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const options = useMemo(
    () => [...(product.options ?? [])].sort((a, b) => a.position - b.position),
    [product.options],
  );
  const variants = product.variants ?? [];
  const hasOptions = options.length > 0;

  // ── Option selection → matched variant ──────────────────────────────────────
  const [selection, setSelection] = useState<Record<string, string | null>>({});
  useEffect(() => {
    // Reset when navigating between products.
    setSelection({});
    setActiveImageIndex(0);
  }, [product.id]);

  const matchesSelection = (v: CatalogVariant, sel: Record<string, string | null>) =>
    options.every((o) => v.optionValues[o.id] === sel[o.id]);

  const allSelected = hasOptions && options.every((o) => selection[o.id]);
  const matchedVariant: CatalogVariant | null = hasOptions
    ? allSelected
      ? variants.find((v) => matchesSelection(v, selection)) ?? null
      : null
    : variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  // All axes picked but no such variant → the combination isn't offered
  // (unpriced matrix cells were skipped at migration).
  const unavailableCombo = hasOptions && allSelected && !matchedVariant;

  const price = matchedVariant?.effectivePrice ?? 0;
  const effectiveInquiry = !matchedVariant || price <= 0;

  // Per-value prices in the selects (the legacy configurator look):
  //  • values with a STATIC display hint (option_values.price — flat-priced
  //    legacy rows like Konstrukcija/Baza) always show it, never changing;
  //  • hint-less values (the matrix-priced axis, legacy Grafika, whose price
  //    depends on the FIRST axis) derive their price from any variant matching
  //    (first-axis selection + this value): variant total − the hinted
  //    contributions of its other coordinates. Recomputed only when the first
  //    axis changes — exactly the legacy behaviour.
  // The first axis is the driver: later axes stay LOCKED until it's chosen.
  const firstAxis = options[0] ?? null;
  const firstSelected = !!(firstAxis && selection[firstAxis.id]);

  const hintOf = (axisId: string, valueId: string | undefined): number | null => {
    if (!valueId) return null;
    const axis = options.find((o) => o.id === axisId);
    return axis?.values.find((v) => v.id === valueId)?.price ?? null;
  };

  const derivedPrice = (axis: (typeof options)[number], valueId: string): number | null => {
    if (!firstAxis || axis.id === firstAxis.id || !firstSelected) return null;
    const candidate = variants.find(
      (v) => v.optionValues[axis.id] === valueId && v.optionValues[firstAxis.id] === selection[firstAxis.id],
    );
    if (!candidate) return null;
    let derived = candidate.effectivePrice;
    for (const other of options) {
      if (other.id === axis.id) continue;
      derived -= hintOf(other.id, candidate.optionValues[other.id]) ?? 0;
    }
    return derived >= 0 ? derived : null;
  };

  const optionFields = options.map((o, idx) => {
    const locked = idx > 0 && !firstSelected;
    const values = [...o.values].sort((a, b) => a.position - b.position);
    const opts: SelectOption[] = values.map((val) => {
      const base = val.label || val.value;
      const cents = val.price ?? derivedPrice(o, val.id);
      return { value: val.id, label: cents != null && cents > 0 ? `${base} — ${eurCents(cents)}` : base };
    });
    return (
      <ConfigField
        key={o.id}
        label={o.label || o.name}
        options={opts}
        value={selection[o.id] ?? null}
        onChange={(v) =>
          setSelection((prev) => {
            const next = { ...prev, [o.id]: v };
            // Clearing the driver resets the dependent axes (their prices key off it).
            if (firstAxis && o.id === firstAxis.id && !v) {
              for (const other of options) if (other.id !== o.id) next[other.id] = null;
            }
            return next;
          })
        }
        placeholder={t("product.option_placeholder")}
        disabled={locked}
        helper={t("product.option_locked")}
      />
    );
  });

  // ── Gallery ─────────────────────────────────────────────────────────────────
  const allImages = product.gallery ?? [];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImage = allImages[activeImageIndex] ?? null;

  // ── Body: description text + info tabs (from the Mixed Content sections) ────
  const { about, tabs } = useMemo(() => extractBody(product.blocks), [product.blocks]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const isMobileInfo = useMediaQuery("(max-width: 760px)", false, { getInitialValueInEffect: false });
  const [openInfoItem, setOpenInfoItem] = useState<string | null>(null);
  const activeTab = tabs.find((tb) => tb.id === (activeTabId ?? tabs[0]?.id)) ?? tabs[0] ?? null;

  // ── Category label + listing URL ────────────────────────────────────────────
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [allProductsSlug, setAllProductsSlug] = useState("svi-proizvodi");
  useEffect(() => {
    let alive = true;
    void storefront.listCategories({ locale }).then((cats) => { if (alive) setCategories(cats); }).catch(() => {});
    void getSystemPageSlug("all-products", locale).then((s) => { if (alive) setAllProductsSlug(s); }).catch(() => {});
    return () => { alive = false; };
  }, [locale]);
  const primaryCat = categories.find((c) => c.id === product.primaryCategoryId) ?? null;
  const categoryTitle = primaryCat?.label ?? "";
  const allProductsUrl = `/${locale}/${allProductsSlug}`;

  // ── Related rail — same primary category ────────────────────────────────────
  const [related, setRelated] = useState<ProductCard[]>([]);
  useEffect(() => {
    let alive = true;
    if (!product.primaryCategoryId) { setRelated([]); return; }
    void storefront
      .listProducts({ locale, category: product.primaryCategoryId, limit: 9 })
      .then((res) => { if (alive) setRelated(res.data.filter((p) => p.id !== product.id).slice(0, 8)); })
      .catch(() => { if (alive) setRelated([]); });
    return () => { alive = false; };
  }, [product.id, product.primaryCategoryId, locale]);

  // ── SEO + JSON-LD ───────────────────────────────────────────────────────────
  const canonicalPath = [...(product.categoryPath ?? []), product.slug].join("/");
  useDocumentSeo(
    {
      title: product.name,
      metaTitle: product.metaTitle ?? null,
      metaDescription: product.metaDescription ?? product.shortDescription ?? null,
      ogImageUrl: allImages[0]?.cdnUrl ?? null,
      canonicalUrl: typeof window !== "undefined" ? `${window.location.origin}/${locale}/${canonicalPath}` : null,
      noindex: false,
    },
    settings,
  );
  const jsonLd = product.jsonLd;
  useEffect(() => {
    if (!jsonLd) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [jsonLd]);

  // Language switcher targets — the resolver matches a product by its bare
  // per-locale slug, so `/{locale}/{slug}` always lands on this product.
  const { setAlternates } = usePageAlternates();
  useEffect(() => {
    const alts = product.alternates ?? {};
    setAlternates(Object.fromEntries(Object.entries(alts).map(([loc, a]) => [loc, { active: true, slug: a.slug }])));
    return () => setAlternates(null);
  }, [product, setAlternates]);

  // ── Share row ───────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const pageUrl = () => (typeof window !== "undefined" ? window.location.href : "");
  const onShareNative = () => {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof navigator !== "undefined" && nav.share) {
      void nav.share({ title: product.name, url: pageUrl() }).catch(() => {});
    }
  };
  const onCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(pageUrl()).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }).catch(() => {});
    }
  };
  const onEmailShare = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(product.name)}&body=${encodeURIComponent(pageUrl())}`;
  };

  // ── Cart CTA ────────────────────────────────────────────────────────────────
  const { cart, add } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const needsSelection = hasOptions && !allSelected;
  const alreadyInCart = !!matchedVariant && (cart?.items ?? []).some((it) => it.variantId === matchedVariant.id);

  const addLabel = tx("product.add_to_cart", "Dodaj u košaricu");
  const addedLabel = tx("product.added_to_cart", "Dodano u košaricu");
  const inCartLabel = tx("product.in_cart", "U košarici");

  const handleAddToCart = () => {
    if (!matchedVariant || alreadyInCart) return;
    void add(matchedVariant.id).then((ok) => {
      if (!ok) return;
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 1600);
      notifications.show({ title: addedLabel, message: product.name });
    });
  };

  return (
    <div className="pi-page">
      {/* ── BREADCRUMB ── Home → catalogue landing → product. */}
      <nav className="pi-crumb" aria-label="Staza">
        <div className="ln-container pi-crumb__in">
          <Link to={`/${locale}/`}>{t("product.breadcrumb_home")}</Link>
          <Fragment>
            <span className="sep">/</span>
            <Link to={allProductsUrl}>{tx("product.breadcrumb_products", "Svi proizvodi")}</Link>
          </Fragment>
          <span className="sep">/</span>
          <span className="cur">{product.name}</span>
        </div>
      </nav>

      {/* ── HERO ── gallery + description (left) · buy/configure card (right) */}
      <section className="pi-hero">
        <div className="ln-container">
          <div className="pi-grid">

            {/* LEFT */}
            <div className="pi-main">
              <div className="pi-gallery">
                <div className="pi-gallery__main">
                  {activeImage && (
                    <img className="ln-img" src={activeImage.cdnUrl + "?width=800"} alt={product.name} />
                  )}
                </div>
                {allImages.length > 1 && (
                  <div className="pi-thumbs">
                    {allImages.slice(0, 10).map((img, i) => (
                      <button
                        type="button"
                        key={img.mediaId}
                        className={`pi-thumb${i === activeImageIndex ? " is-active" : ""}`}
                        onClick={() => setActiveImageIndex(i)}
                        aria-label={`${t("product.aria_view_image")} ${i + 1}`}
                        aria-current={i === activeImageIndex}
                      >
                        <img className="ln-img" src={img.cdnUrl + "?width=200"} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {about.length > 0 && (
                <section className="pi-about">
                  <h2>{t("product.about_heading")}</h2>
                  {about.map((doc, i) => (
                    <div key={i} className="pi-rich" dangerouslySetInnerHTML={{ __html: tiptapToHtml(doc) }} />
                  ))}
                </section>
              )}
            </div>

            {/* RIGHT — sticky buy / configure */}
            <aside className="pi-buy">
              {categoryTitle && <span className="pi-eyebrow pi-buy__cat">{categoryTitle}</span>}
              <h1>{product.name}</h1>
              {product.shortDescription && <p className="pi-buy__sub">{product.shortDescription}</p>}

              <div className="pi-badges">
                <span className="pi-badge">
                  <Check aria-hidden="true" />
                  {t("product.trust_available")}
                </span>
                <span className="pi-badge">
                  <Truck aria-hidden="true" />
                  {t("product.trust_fast_delivery")}
                </span>
              </div>

              <div className="pi-price">
                {!effectiveInquiry && (
                  <p className="pi-price__lbl">
                    {hasOptions ? t("product.price_estimated_label") : tx("product.price_fixed_label", "Cijena")}
                  </p>
                )}
                <div className="pi-price__row">
                  {effectiveInquiry ? (
                    <span className="pi-price__big is-inquiry">{t("product.price_inquiry_label")}</span>
                  ) : (
                    <>
                      <span className="pi-price__big">{eurCents(price)}</span>
                      <span className="pi-price__vat">{t("product.price_vat_suffix")}</span>
                    </>
                  )}
                </div>

                {hasOptions && (
                  <div className="pi-config">
                    <h3 className="pi-config__h">{t("product.configurator_heading")}</h3>
                    {optionFields}
                  </div>
                )}

                <button
                  type="button"
                  className="ln-btn ln-btn--primary ln-btn--lg pi-cta"
                  onClick={handleAddToCart}
                  disabled={needsSelection || unavailableCombo || alreadyInCart}
                >
                  {justAdded || alreadyInCart ? (
                    <>
                      <Check size={18} aria-hidden="true" />
                      {alreadyInCart && !justAdded ? inCartLabel : addedLabel}
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={18} aria-hidden="true" />
                      {addLabel}
                    </>
                  )}
                </button>
                {needsSelection && (
                  <p className="pi-cta-hint">
                    {tx("product.select_option_hint", "Odaberite opciju za nastavak.")}
                  </p>
                )}
                {unavailableCombo && (
                  <p className="pi-cta-hint">
                    {tx("product.combo_unavailable", "Odabrana kombinacija nije dostupna — pošaljite upit ili odaberite drugu opciju.")}
                  </p>
                )}

                <div className="pi-share">
                  <span className="pi-share__lbl">{t("product.share_label")}</span>
                  <button
                    type="button"
                    className="pi-share__btn"
                    aria-label={t("product.share_native")}
                    onClick={onShareNative}
                  >
                    <Share2 aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="pi-share__btn"
                    aria-label={t("product.share_copy_link")}
                    onClick={onCopyLink}
                  >
                    <Link2 aria-hidden="true" />
                    <span className={`pi-share__tip${copied ? " show" : ""}`}>
                      {tx("product.share_copied", "Kopirano")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pi-share__btn"
                    aria-label={t("product.share_email")}
                    onClick={onEmailShare}
                  >
                    <Mail aria-hidden="true" />
                  </button>
                </div>
              </div>
            </aside>

          </div>
        </div>
      </section>

      {/* ── INFO TABS ── desktop tabs / ≤760px accordion (single-open). */}
      {tabs.length > 0 && (
        <section className="pi-tabs-sec">
          <div className="ln-container">
            <h2>{tx("product.details_heading", "Detalji proizvoda")}</h2>
            {isMobileInfo ? (
              <div className="pi-tabs">
                {tabs.map((tab) => {
                  const isOpen = openInfoItem === tab.id;
                  return (
                    <div className={`pi-acc${isOpen ? " is-open" : ""}`} key={tab.id}>
                      <button
                        type="button"
                        className="pi-acc__h"
                        aria-expanded={isOpen}
                        onClick={() => setOpenInfoItem(isOpen ? null : tab.id)}
                      >
                        {tab.title || t("product.option_unnamed")}
                        <ChevronDown aria-hidden="true" />
                      </button>
                      <div className="pi-acc__p">
                        {tab.content ? (
                          <div
                            className="pi-rich"
                            dangerouslySetInnerHTML={{ __html: tiptapToHtml(tab.content) }}
                          />
                        ) : (
                          <p className="pi-empty">{t("product.tab_empty")}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pi-tabs">
                <div className="pi-tabs__head" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === (activeTab?.id ?? null)}
                      className={`pi-tab${tab.id === (activeTab?.id ?? null) ? " is-active" : ""}`}
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      {tab.title || t("product.option_unnamed")}
                    </button>
                  ))}
                </div>
                <div className="pi-tabs__body">
                  {activeTab && activeTab.content ? (
                    <div
                      className="pi-rich"
                      dangerouslySetInnerHTML={{ __html: tiptapToHtml(activeTab.content) }}
                    />
                  ) : (
                    <p className="pi-empty">{t("product.tab_empty")}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── RELATED ── same-primary-category products. Hidden when none. */}
      {related.length > 0 && (
        <section className="pi-rel">
          <div className="ln-container">
            <div className="pi-rel__head">
              <div>
                <span className="pi-eyebrow">{tx("product.related_eyebrow", "Iz iste kategorije")}</span>
                <h2>{tx("product.related_heading", "Srodni proizvodi")}</h2>
              </div>
              <Link to={allProductsUrl} className="ln-btn ln-btn--ghost">
                {tx("product.related_all_products", "Svi proizvodi")}
              </Link>
            </div>
            <div className="a-products">
              {related.map((p) => (
                <Link key={p.id} to={`/${locale}/${allProductsSlug}/${p.slug}`} className="a-prod">
                  <div className="a-thumb">
                    {p.image && <img className="ln-img" src={p.image.cdnUrl + "?width=300"} alt={p.name} loading="lazy" />}
                  </div>
                  <div className="a-prod__b">
                    {categoryTitle && <div className="a-prod__cat">{categoryTitle}</div>}
                    <h3>{p.name}</h3>
                    {p.price > 0 ? (
                      <div className="a-prod__price">
                        {p.variantCount > 1 ? `${t("allproducts.price_from")} ` : ""}
                        {eurCents(p.price)} <small>{t("product.price_vat_suffix")}</small>
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

      {/* ── MOBILE STICKY BAR ── (CSS shows it ≤760px) */}
      <div className="pi-bar">
        <div className="pi-bar__price">
          <span className="pi-bar__lbl">
            {effectiveInquiry ? t("product.mobile_price_label") : t("product.mobile_total_label")}
          </span>
          <span className={`pi-bar__val${effectiveInquiry ? " is-inquiry" : ""}`}>
            {effectiveInquiry ? t("product.mobile_on_inquiry") : eurCents(price)}
          </span>
        </div>
        <button
          type="button"
          className="ln-btn ln-btn--primary"
          onClick={handleAddToCart}
          disabled={needsSelection || unavailableCombo || alreadyInCart}
        >
          {alreadyInCart ? inCartLabel : justAdded ? addedLabel : addLabel}
        </button>
      </div>
      {/* Spacer so the footer clears the fixed mobile bar (≤760px). */}
      <div className="pi-bar-spacer" />
    </div>
  );
}
