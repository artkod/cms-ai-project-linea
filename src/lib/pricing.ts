// Shared product-price helpers (Clean & Corporate handoff §2).
//
// `computeCardPrice` (the card/listing price) lives in AllProductsView and is
// imported where product cards render. This module holds the lower-level
// primitives plus the design's symbol-first euro formatter so the product page,
// related rail, etc. all agree on "€1.234,56" output.

/** Parse a free-text price string like "12,34" or "12.34" into a number.
 *  Empty / invalid / non-positive → 0. */
export function parsePrice(v: unknown): number {
  if (typeof v !== "string") return 0;
  const s = v.replace(",", ".").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Croatian-formatted amount, symbol first (the design prints "€1.234,56"). */
export function eur(n: number): string {
  return "€" + n.toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Same formatter for integer EUR cents (the commerce API's money unit). */
export function eurCents(cents: number): string {
  return eur(cents / 100);
}

/** Currency-style formatter ("1.234,56 €", symbol last). Kept for callers that
 *  still render the Intl currency form. New design surfaces use `eur()`. */
export const eurFmt = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
