import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, X } from "lucide-react";
import type { Order } from "@cms/storefront";
import { storefront } from "@/lib/storefront";
import { useStrings, useLocaleConfig } from "@/lib/locale";
import { eurCents } from "@/lib/pricing";
import "@/styles/components/modals.scss";

// Cart checkout modal — built on the site's `.lm-*` modal shell (same chrome as
// the cookie + newsletter modals). Left column captures delivery/contact
// details; the right column is a live order summary of the SERVER cart lines.
// Submitting POSTs the real commerce checkout: every product in this shop is
// inquiry-only, so the checkout lands as a QUOTE (inquiry) — no payment. The
// success screen links to the order/inquiry status page (/{locale}/order/{token}),
// the same URL the quote email later points at.

export interface InquiryItem {
  title: string;
  qty: number;
  /** null = "price on request" (0-cent line). */
  unitPrice: number | null; // EUR cents
  configLabel?: string;
  image?: string | null;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  company: string;
  note: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  company: "",
  note: "",
};

export function InquiryModal({
  opened,
  onClose,
  items,
  onSuccess,
}: {
  opened: boolean;
  onClose: () => void;
  items: InquiryItem[];
  onSuccess?: () => void;
}) {
  const { t } = useStrings();
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);

  // Read the value BEFORE queueing the state update — React nulls
  // `e.currentTarget` once the event dispatch finishes, and functional updaters
  // run later (at render), so reading it inside the updater crashes the tree.
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.currentTarget.value;
    setForm((p) => ({ ...p, [k]: value }));
  };

  const anyPriced = items.some((i) => i.unitPrice != null);
  const anyUnpriced = items.some((i) => i.unitPrice == null);
  const total = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.qty, 0);

  // Reset to a fresh form + form view each time the modal opens.
  useEffect(() => {
    if (!opened) return;
    setOrder(null);
    setErrors({});
    setForm(EMPTY);
    setSubmitError(false);
    setSubmitting(false);
  }, [opened]);

  // Body scroll-lock + Esc while open (same pattern as the other site modals).
  useEffect(() => {
    if (!opened) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [opened, onClose]);

  if (!opened) return null;

  const requiredMsg = tx("order.required", "Obavezno polje");
  const invalidEmailMsg = tx("order.invalid_email", "Neispravna email adresa");
  const onRequest = tx("order.on_request", "Na upit");
  const optional = tx("order.optional", "opcionalno");

  function validate(): boolean {
    const er: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) er.firstName = requiredMsg;
    if (!form.lastName.trim()) er.lastName = requiredMsg;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) er.email = invalidEmailMsg;
    if (!form.phone.trim()) er.phone = requiredMsg;
    if (!form.address.trim()) er.address = requiredMsg;
    if (!form.city.trim()) er.city = requiredMsg;
    if (!form.postalCode.trim()) er.postalCode = requiredMsg;
    setErrors(er);
    return Object.keys(er).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    // The company name has no dedicated field on the order — fold it into the
    // note so the merchant still sees it on the inquiry.
    const note = [form.company.trim() && `${tx("order.company_label", "Naziv tvrtke")}: ${form.company.trim()}`, form.note.trim()]
      .filter(Boolean)
      .join("\n");
    try {
      const placed = await storefront.startCheckout(
        {
          email: form.email.trim(),
          shippingAddress: {
            name: `${form.firstName.trim()} ${form.lastName.trim()}`,
            line1: form.address.trim(),
            city: form.city.trim(),
            postalCode: form.postalCode.trim(),
            country: "HR",
            phone: form.phone.trim(),
          },
          ...(note ? { note } : {}),
        },
        { locale },
      );
      setOrder(placed);
      onSuccess?.();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  const title = tx("order.title_cart", "Pošaljite upit");
  const lead = tx("order.lead_cart", "Ispunite podatke i pošaljite upit — javljamo se s ponudom i rokom isporuke.");
  const summaryTitle = tx("order.summary_cart", "Vaš upit");
  const submitLabel = tx("order.submit_cart", "Pošalji upit");

  return (
    <div className="lm-overlay is-open" role="dialog" aria-modal="true" aria-label={title}>
      <div className="lm-overlay__bg" onClick={onClose} />
      <div className="lm-modal lm-modal--wide">
        <button type="button" className="lm-x" aria-label={tx("order.close", "Zatvori")} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <div className="lm-modal__body">
          {order ? (
            <div className="om-success">
              <div className="lm-icon"><Check aria-hidden="true" /></div>
              <h2>{tx("order.success_title_inquiry", "Hvala na upitu!")}</h2>
              <p>
                {tx("order.success_text", "Zaprimili smo vaš upit i javit ćemo vam se s ponudom u najkraćem roku.")}
                {" "}
                {tx("order.success_number", "Broj upita")}: <b>#{order.orderNumber}</b>
              </p>
              <Link
                to={`/${locale}/order/${order.token}`}
                className="ln-btn ln-btn--primary"
                style={{ marginTop: 24 }}
                onClick={onClose}
              >
                {tx("order.view_inquiry", "Pregledajte svoj upit")}
              </Link>
              <button type="button" className="ln-btn ln-btn--ghost" style={{ marginTop: 12 }} onClick={onClose}>
                {tx("order.close", "Zatvori")}
              </button>
            </div>
          ) : (
            <>
              <h2>{title}</h2>
              <p className="lm-modal__lead">{lead}</p>

              <form id="omFields" onSubmit={handleSubmit} noValidate>
                <div className="om-grid">
                  {/* Left — delivery form */}
                  <div className="om-fields">
                    <div className="om-row">
                      <div className="om-field">
                        <label htmlFor="omFirst">{tx("order.first_name", "Ime")}</label>
                        <input id="omFirst" className={`om-input${errors.firstName ? " is-err" : ""}`}
                          autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
                        {errors.firstName && <p className="om-err">{errors.firstName}</p>}
                      </div>
                      <div className="om-field">
                        <label htmlFor="omLast">{tx("order.last_name", "Prezime")}</label>
                        <input id="omLast" className={`om-input${errors.lastName ? " is-err" : ""}`}
                          autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
                        {errors.lastName && <p className="om-err">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div className="om-row">
                      <div className="om-field">
                        <label htmlFor="omPhone">{tx("order.phone", "Telefon")}</label>
                        <input id="omPhone" className={`om-input${errors.phone ? " is-err" : ""}`}
                          type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
                        {errors.phone && <p className="om-err">{errors.phone}</p>}
                      </div>
                      <div className="om-field">
                        <label htmlFor="omEmail">{tx("order.email", "Email")}</label>
                        <input id="omEmail" className={`om-input${errors.email ? " is-err" : ""}`}
                          type="email" autoComplete="email" value={form.email} onChange={set("email")} />
                        {errors.email && <p className="om-err">{errors.email}</p>}
                      </div>
                    </div>

                    <div className="om-field">
                      <label htmlFor="omAddr">{tx("order.address", "Adresa za dostavu")}</label>
                      <input id="omAddr" className={`om-input${errors.address ? " is-err" : ""}`}
                        autoComplete="street-address" value={form.address} onChange={set("address")} />
                      {errors.address && <p className="om-err">{errors.address}</p>}
                    </div>

                    <div className="om-row">
                      <div className="om-field">
                        <label htmlFor="omCity">{tx("order.city", "Grad")}</label>
                        <input id="omCity" className={`om-input${errors.city ? " is-err" : ""}`}
                          autoComplete="address-level2" value={form.city} onChange={set("city")} />
                        {errors.city && <p className="om-err">{errors.city}</p>}
                      </div>
                      <div className="om-field">
                        <label htmlFor="omPostal">{tx("order.postal_code", "Poštanski broj")}</label>
                        <input id="omPostal" className={`om-input${errors.postalCode ? " is-err" : ""}`}
                          autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={set("postalCode")} />
                        {errors.postalCode && <p className="om-err">{errors.postalCode}</p>}
                      </div>
                    </div>

                    <div className="om-field">
                      <label htmlFor="omCompany">
                        {tx("order.company_label", "Naziv tvrtke")} <span className="om-opt">({optional})</span>
                      </label>
                      <input id="omCompany" className="om-input" autoComplete="organization"
                        value={form.company} onChange={set("company")} />
                    </div>

                    <div className="om-field">
                      <label htmlFor="omNotes">
                        {tx("order.note_label", "Napomena")} <span className="om-opt">({optional})</span>
                      </label>
                      <textarea id="omNotes" className="om-textarea" rows={3}
                        value={form.note} onChange={set("note")} />
                    </div>
                  </div>

                  {/* Right — live order summary */}
                  <aside className="om-summary">
                    <h3 className="om-summary__h">{summaryTitle}</h3>
                    <div className="om-lines">
                      {items.map((it, idx) => (
                        <div className="om-line" key={idx}>
                          <div className="om-line__media">
                            {it.image && <img src={it.image} alt={it.title} loading="lazy" />}
                          </div>
                          <div className="om-line__body">
                            <div className="om-line__name">
                              {it.title}{it.configLabel ? ` — ${it.configLabel}` : ""}
                            </div>
                            <div className="om-line__meta">
                              {it.qty} × {it.unitPrice != null ? eurCents(it.unitPrice) : onRequest}
                            </div>
                          </div>
                          <div className="om-line__total">
                            {it.unitPrice != null ? eurCents(it.unitPrice * it.qty) : onRequest}
                          </div>
                        </div>
                      ))}
                    </div>

                    {anyPriced && (
                      <>
                        <hr className="om-sumdiv" />
                        <div className="om-total">
                          <span className="om-total__k">
                            {anyUnpriced ? tx("order.total_min", "Ukupna minimalna cijena") : tx("order.total", "Ukupno")}
                          </span>
                          <span className="om-total__v">{eurCents(total)}</span>
                        </div>
                      </>
                    )}

                    <p className="om-note">
                      {anyPriced && anyUnpriced
                        ? tx("order.vat_note_mixed", "Cijene uključuju PDV. Dostava se obračunava naknadno. Proizvodi koji nemaju istaknutu cijenu nisu uključeni u ukupni zbroj te konačna cijena može biti veća od navedene.")
                        : tx("order.vat_note", "Cijene uključuju PDV. Dostava se obračunava naknadno.")}
                    </p>

                    {submitError && (
                      <p className="om-err" role="alert">
                        {tx("order.submit_error", "Slanje nije uspjelo. Pokušajte ponovno ili nam se javite izravno.")}
                      </p>
                    )}

                    <button type="submit" className="ln-btn ln-btn--primary ln-btn--lg om-submit" disabled={submitting}>
                      {submitting ? tx("order.submitting", "Slanje…") : submitLabel}
                    </button>
                  </aside>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
