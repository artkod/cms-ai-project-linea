import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useStrings } from "@/lib/locale";
import { eur } from "@/lib/pricing";
import "@/styles/components/modals.scss";

// Shared order / inquiry modal — built on the site's `.lm-*` modal shell (same
// chrome as the cookie + newsletter modals). Two contexts:
//  • cart checkout  — every cart line + a delivery form ("Dovrši narudžbu")
//  • product inquiry — a single no-price product sends itself ("Pošaljite upit")
// Left column captures delivery/contact details; the right column is a live
// order summary. This is an inquiry model — no payment, no real submission: the
// email/order backend isn't built yet, so submit runs a frontend-only success
// (clears the cart via onSuccess) with a TODO hook for the real send.

export interface InquiryItem {
  title: string;
  qty: number;
  /** null = "price on request" (no-price product). */
  unitPrice: number | null;
  configLabel?: string;
  image?: string | null;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  company: string;
  note: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  company: "",
  note: "",
};

export function InquiryModal({
  opened,
  onClose,
  mode,
  items,
  onSuccess,
}: {
  opened: boolean;
  onClose: () => void;
  mode: "cart" | "inquiry";
  items: InquiryItem[];
  onSuccess?: () => void;
}) {
  const { t } = useStrings();
  const tx = (key: string, fb: string) => {
    const v = t(key);
    return v === key ? fb : v;
  };

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.currentTarget.value }));

  const anyPriced = items.some((i) => i.unitPrice != null);
  const anyUnpriced = items.some((i) => i.unitPrice == null);
  const total = items.reduce((s, i) => s + (i.unitPrice ?? 0) * i.qty, 0);

  // Reset to a fresh form + form view each time the modal opens.
  useEffect(() => {
    if (!opened) return;
    setSubmitted(false);
    setErrors({});
    setForm(EMPTY);
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
    setErrors(er);
    return Object.keys(er).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    // TODO: POST { items, total, form } to the order/inquiry email endpoint once
    // it exists (cart contents + delivery details emailed to Linea). Frontend-only
    // success for now.
    setSubmitted(true);
    onSuccess?.();
  }

  const title = mode === "cart"
    ? tx("order.title_cart", "Dovrši narudžbu")
    : tx("order.title_inquiry", "Pošaljite upit");
  const lead = mode === "cart"
    ? tx("order.lead_cart", "Ispunite podatke za dostavu i pošaljite narudžbu — javljamo se s potvrdom i rokom isporuke.")
    : tx("order.lead_inquiry", "Pošaljite nam upit i javljamo se s ponudom u najkraćem roku.");
  const summaryTitle = mode === "cart"
    ? tx("order.summary_cart", "Vaša narudžba")
    : tx("order.summary_inquiry", "Vaš upit");
  const submitLabel = mode === "cart"
    ? tx("order.submit_cart", "Pošalji narudžbu")
    : tx("order.submit_inquiry", "Pošalji upit");

  return (
    <div className="lm-overlay is-open" role="dialog" aria-modal="true" aria-label={title}>
      <div className="lm-overlay__bg" onClick={onClose} />
      <div className="lm-modal lm-modal--wide">
        <button type="button" className="lm-x" aria-label={tx("order.close", "Zatvori")} onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <div className="lm-modal__body">
          {submitted ? (
            <div className="om-success">
              <div className="lm-icon"><Check aria-hidden="true" /></div>
              <h2>
                {mode === "cart"
                  ? tx("order.success_title_cart", "Hvala na narudžbi!")
                  : tx("order.success_title_inquiry", "Hvala na upitu!")}
              </h2>
              <p>
                {mode === "cart"
                  ? tx("order.success_text_cart", "Zaprimili smo vašu narudžbu. Naš tim javlja se uskoro s potvrdom i rokom isporuke na navedeni kontakt.")
                  : tx("order.success_text", "Zaprimili smo vaše podatke i javit ćemo vam se uskoro.")}
              </p>
              <button type="button" className="ln-btn ln-btn--ghost" style={{ marginTop: 24 }} onClick={onClose}>
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
                              {it.qty} × {it.unitPrice != null ? eur(it.unitPrice) : onRequest}
                            </div>
                          </div>
                          <div className="om-line__total">
                            {it.unitPrice != null ? eur(it.unitPrice * it.qty) : onRequest}
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
                          <span className="om-total__v">{eur(total)}</span>
                        </div>
                      </>
                    )}

                    <p className="om-note">
                      {anyPriced && anyUnpriced
                        ? tx("order.vat_note_mixed", "Cijene uključuju PDV. Dostava se obračunava naknadno. Proizvodi koji nemaju istaknutu cijenu nisu uključeni u ukupni zbroj te konačna cijena može biti veća od navedene.")
                        : tx("order.vat_note", "Cijene uključuju PDV. Dostava se obračunava naknadno.")}
                    </p>

                    <button type="submit" className="ln-btn ln-btn--primary ln-btn--lg om-submit">
                      {submitLabel}
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
