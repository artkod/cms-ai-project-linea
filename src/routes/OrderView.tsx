import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Loader } from "@mantine/core";
import { Check, Clock, FileQuestion, X } from "lucide-react";
import type { Order } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useStrings, useLocaleConfig, usePageLayout } from "@/lib/locale";
import { eurCents } from "@/lib/pricing";
import { NotFound } from "./NotFound";
import "@/styles/pages/cart.scss";
import "@/styles/pages/order.scss";

// Inquiry / order status page — /{locale}/order/{token}. The checkout success
// screen and the quote email both land here. States (inquiry-only shop):
//   • quote draft   — inquiry received, merchant is preparing an offer
//   • quote sent    — the offer with real prices + Accept / Decline actions
//   • accepted      — (isQuote flips off) merchant follows up with payment/delivery
//   • declined/expired — closed
// Shares the cart page's shell (.cr-head/.cr-body/.cr-grid/.cr-summary); the
// status banner + image-less order lines have their own .op-* styles (order.scss).

type QuoteState = "draft" | "sent" | "accepted" | "declined" | "expired" | "order";

function quoteState(order: Order): QuoteState {
  if (order.quoteStatus === "sent") return "sent";
  if (order.quoteStatus === "declined") return "declined";
  if (order.quoteStatus === "expired") return "expired";
  if (order.quoteStatus === "accepted") return "accepted";
  if (order.isQuote) return "draft";
  return "order";
}

export function OrderView() {
  const { locale: localeParam, token } = useParams<{ locale: string; token: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);

  // The `.cr-*` bands are full-width (like the cart page) — drop RootLayout's
  // centered container while this route is mounted.
  const { setFullBleed } = usePageLayout();
  useEffect(() => {
    setFullBleed(true);
    return () => setFullBleed(false);
  }, [setFullBleed]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrder(await storefront.getOrder(token));
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="ln-container ln-loading">
        <Loader color="var(--brand)" />
      </div>
    );
  }
  if (notFound || !order || !token) return <NotFound />;

  const state = quoteState(order);
  const onRequest = tx("order.on_request", "Na upit");
  const anyOnRequest = order.items.some((it) => it.unitPrice <= 0);
  const total = order.totals?.grossTotal ?? 0;

  const act = async (fn: () => Promise<Order>) => {
    if (acting) return;
    setActing(true);
    try {
      setOrder(await fn());
    } catch {
      /* keep current state; the reload button below refetches */
      void load();
    } finally {
      setActing(false);
      setConfirmDecline(false);
    }
  };

  const stateChip = (() => {
    switch (state) {
      case "draft":
        return { icon: <Clock aria-hidden="true" />, text: tx("orderpage.state_draft", "Upit zaprimljen — pripremamo ponudu i javljamo se u najkraćem roku.") };
      case "sent":
        return { icon: <FileQuestion aria-hidden="true" />, text: tx("orderpage.state_sent", "Ponuda je spremna — pregledajte stavke i prihvatite ili odbijte ponudu.") };
      case "accepted":
        return { icon: <Check aria-hidden="true" />, text: tx("orderpage.state_accepted", "Ponuda je prihvaćena. Javit ćemo vam se s detaljima plaćanja i isporuke.") };
      case "declined":
        return { icon: <X aria-hidden="true" />, text: tx("orderpage.state_declined", "Ponuda je odbijena.") };
      case "expired":
        return { icon: <Clock aria-hidden="true" />, text: tx("orderpage.state_expired", "Ponuda je istekla. Slobodno pošaljite novi upit.") };
      default:
        return { icon: <Check aria-hidden="true" />, text: tx("orderpage.state_order", "Narudžba je zaprimljena. Javit ćemo vam se s detaljima plaćanja i isporuke.") };
    }
  })();

  const validUntil = order.validUntil
    ? new Date(order.validUntil).toLocaleDateString("hr-HR", { day: "numeric", month: "numeric", year: "numeric" })
    : null;

  return (
    <div className="cr-page">
      <section className="cr-head">
        <div className="ln-container">
          <div className="cr-head__row">
            <h1>
              {state === "order"
                ? tx("orderpage.title_order", "Narudžba")
                : tx("orderpage.title", "Upit")}{" "}
              #{order.orderNumber}
            </h1>
          </div>
        </div>
      </section>

      <section className="cr-body">
        <div className="ln-container">
          <div className="cr-grid">
            <div>
              {/* Status banner */}
              <div className="op-status">
                <div className="op-status__ico">{stateChip.icon}</div>
                <div className="op-status__text">
                  <p>{stateChip.text}</p>
                  {state === "sent" && validUntil && (
                    <p className="op-status__meta">
                      {tx("orderpage.valid_until", "Ponuda vrijedi do")}: <b>{validUntil}</b>
                    </p>
                  )}
                </div>
              </div>

              {/* Lines */}
              <div className="op-lines">
                {order.items.map((it) => (
                  <div className="op-line" key={it.id}>
                    <div className="op-line__top">
                      <h3 className="op-line__name">{it.name}</h3>
                      <div className="op-line__total">
                        {it.unitPrice > 0 ? eurCents(it.gross) : onRequest}
                      </div>
                    </div>
                    {it.optionsLabel && <div className="op-line__config">{it.optionsLabel}</div>}
                    <div className="op-line__qty">
                      {it.quantity} × {it.unitPrice > 0 ? eurCents(it.unitPrice) : onRequest}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="cr-summary">
              <h2>{tx("orderpage.summary", "Sažetak")}</h2>
              <div className="cr-sumrow">
                <span className="k">{tx("orderpage.items", "Stavke")}</span>
                <span className="v">{order.itemCount}</span>
              </div>
              <hr className="cr-sumdiv" />
              <div className="cr-sumtotal">
                <span className="k">
                  {anyOnRequest ? tx("order.total_min", "Ukupna minimalna cijena") : tx("order.total", "Ukupno")}
                </span>
                <span className="v">{total > 0 ? eurCents(total) : onRequest}</span>
              </div>

              {state === "sent" && (
                <>
                  <button
                    type="button"
                    className="ln-btn ln-btn--primary ln-btn--lg cr-checkout"
                    disabled={acting}
                    onClick={() => void act(() => storefront.acceptQuote(token))}
                  >
                    {tx("orderpage.accept", "Prihvati ponudu")}
                  </button>
                  {confirmDecline ? (
                    <button
                      type="button"
                      className="ln-btn ln-btn--ghost cr-checkout"
                      disabled={acting}
                      onClick={() => void act(() => storefront.declineQuote(token))}
                    >
                      {tx("orderpage.decline_confirm", "Sigurno odbij ponudu?")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ln-btn ln-btn--ghost cr-checkout"
                      disabled={acting}
                      onClick={() => setConfirmDecline(true)}
                    >
                      {tx("orderpage.decline", "Odbij ponudu")}
                    </button>
                  )}
                </>
              )}

              <Link to={`/${locale}/`} className="cr-continue">
                {tx("orderpage.back_home", "Natrag na početnu")}
              </Link>
              <p className="cr-vat">
                {tx("order.vat_note", "Cijene uključuju PDV. Dostava se obračunava naknadno.")}
              </p>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
