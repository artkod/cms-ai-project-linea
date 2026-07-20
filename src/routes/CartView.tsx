import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Minus, Plus, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { getSystemPageSlug, type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";
import { useCart, lineIsOnRequest } from "@/lib/cart";
import { eurCents } from "@/lib/pricing";
import { InquiryModal, type InquiryItem } from "@/components/InquiryModal";
import "@/styles/pages/cart.scss";

// Croatian item-count word: 1 artikl · 2–4 artikla · else artikala.
function artiklWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "artikl";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "artikla";
  return "artikala";
}

export function CartView({ page }: { page: Page }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };
  const { cart, count, pricedSubtotal, anyOnRequest, remove: removeItem, setQty, refresh } = useCart();
  const items = cart?.items ?? [];
  const onRequest = tx("order.on_request", "Na upit");

  const home = `/${locale}/`;
  const [allProductsSlug, setAllProductsSlug] = useState("svi-proizvodi");
  useEffect(() => {
    getSystemPageSlug("all-products", locale).then(setAllProductsSlug).catch(() => {});
  }, [locale]);
  const productsUrl = `/${locale}/${allProductsSlug}`;

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const inquiryItems: InquiryItem[] = items.map((it) => ({
    title: it.name,
    qty: it.quantity,
    unitPrice: lineIsOnRequest(it) ? null : it.unitPrice,
    configLabel: it.optionsLabel ?? undefined,
    image: it.image?.cdnUrl ?? null,
  }));
  const openCheckout = () => {
    if (count > 0) setCheckoutOpen(true);
  };

  return (
    <div className="cr-page">
      <section className="cr-head">
        <div className="ln-container">
          <div className="cr-head__row">
            <h1>{page.title}</h1>
            {count > 0 && (
              <span className="cr-count">
                {count} {artiklWord(count)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="cr-body">
        <div className="ln-container">
          {count > 0 ? (
            <div className="cr-grid">
              {/* Line items */}
              <div className="cr-list">
                {items.map((l) => {
                  const priced = !lineIsOnRequest(l);
                  const url = l.slug ? `/${locale}/${allProductsSlug}/${l.slug}` : null;
                  return (
                    <div className="cr-item" key={l.variantId}>
                      <div className="cr-item__media">
                        {l.image && <img className="ln-img" src={l.image.cdnUrl} alt={l.name} loading="lazy" />}
                      </div>
                      <div className="cr-item__main">
                        <div className="cr-item__top">
                          <h3 className="cr-item__name">
                            {url ? <Link to={url}>{l.name}</Link> : l.name}
                          </h3>
                          <button
                            type="button"
                            className="cr-item__rm"
                            aria-label={t("cart.remove")}
                            onClick={() => void removeItem(l.variantId)}
                          >
                            <Trash2 aria-hidden="true" />
                            <span className="cr-tip">{t("cart.remove")}</span>
                          </button>
                        </div>

                        <div className="cr-item__price">
                          <span className="cr-k">{t("cart.unit_price")}: </span>
                          {priced ? eurCents(l.unitPrice) : onRequest}
                        </div>
                        {l.optionsLabel && <div className="cr-item__config">{l.optionsLabel}</div>}

                        <div className="cr-item__bottom">
                          <div className="cr-qty">
                            <span className="cr-qty__lbl">{t("cart.quantity")}</span>
                            <div className="cr-stepper">
                              <button
                                type="button"
                                className="cr-step"
                                aria-label="-"
                                disabled={l.quantity <= 1}
                                onClick={() => void setQty(l.variantId, l.quantity - 1)}
                              >
                                <Minus aria-hidden="true" />
                              </button>
                              <input
                                className="cr-num"
                                type="number"
                                min={1}
                                value={l.quantity}
                                aria-label={t("cart.quantity")}
                                onChange={(e) => void setQty(l.variantId, Number(e.currentTarget.value) || 1)}
                              />
                              <button
                                type="button"
                                className="cr-step"
                                aria-label="+"
                                onClick={() => void setQty(l.variantId, l.quantity + 1)}
                              >
                                <Plus aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <div className="cr-item__total">{priced ? eurCents(l.lineTotal) : onRequest}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order summary */}
              <aside className="cr-summary">
                <h2>{t("cart.summary_title")}</h2>
                <div className="cr-sumrow">
                  <span className="k">{t("cart.subtotal")}</span>
                  <span className="v">{eurCents(pricedSubtotal)}</span>
                </div>
                <div className="cr-sumrow">
                  <span className="k">{t("cart.shipping")}</span>
                  <span className="note">{t("cart.shipping_note")}</span>
                </div>
                <hr className="cr-sumdiv" />
                <div className="cr-sumtotal">
                  <span className="k">
                    {anyOnRequest ? tx("order.total_min", "Ukupna minimalna cijena") : t("cart.total")}
                  </span>
                  <span className="v">{eurCents(pricedSubtotal)}</span>
                </div>
                <button
                  type="button"
                  className="ln-btn ln-btn--primary ln-btn--lg cr-checkout"
                  onClick={openCheckout}
                >
                  {tx("cart.finish_order", "Pošalji upit")}
                </button>
                <Link to={home} className="cr-continue">
                  <ArrowLeft aria-hidden="true" />
                  {t("cart.continue_shopping")}
                </Link>
                <p className="cr-vat">
                  {anyOnRequest
                    ? tx("order.vat_note_mixed", "Cijene uključuju PDV. Dostava se obračunava naknadno. Proizvodi koji nemaju istaknutu cijenu nisu uključeni u ukupni zbroj te konačna cijena može biti veća od navedene.")
                    : t("cart.vat_note")}
                </p>
              </aside>
            </div>
          ) : (
            <div className="cr-empty">
              <div className="cr-empty__ico">
                <ShoppingCart aria-hidden="true" strokeWidth={1.6} />
              </div>
              <h2>{t("cart.empty_title")}</h2>
              <p>{t("cart.empty_text")}</p>
              <Link to={productsUrl} className="ln-btn ln-btn--primary ln-btn--lg">
                {t("cart.continue_shopping")}
              </Link>
            </div>
          )}
        </div>
      </section>

      <InquiryModal
        opened={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={inquiryItems}
        onSuccess={() => void refresh()}
      />
    </div>
  );
}
