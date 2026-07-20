import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router";
import type { Cart, CartLine } from "@cms/storefront";
import { storefront } from "./storefront";
import { useLocaleConfig } from "./locale";

// Server-side shopping cart (commerce module). The cart lives in the API keyed
// by the httpOnly `cms_cart` cookie — this context only sends intent (variant id
// + quantity) and stores the full recomputed cart the server returns. All money
// is integer EUR cents and comes from the server; nothing is computed locally.
//
// Every product in this shop is inquiry-only (`purchasable=false`), so checkout
// always creates a QUOTE (inquiry) — but prices stay visible where they exist:
// a 0-cent line renders as "Na upit" (see `lineIsOnRequest`).

export type { Cart, CartLine };

/** A 0-cent line is "price on request" — excluded from the money total display. */
export function lineIsOnRequest(line: CartLine): boolean {
  return line.unitPrice <= 0;
}

interface CartValue {
  cart: Cart | null;
  loading: boolean;
  count: number;
  /** Sum of the PRICED lines (cents) — 0-cent "Na upit" lines contribute nothing. */
  pricedSubtotal: number;
  /** true when any line is "Na upit" (total becomes a stated minimum). */
  anyOnRequest: boolean;
  add: (variantId: string, qty?: number) => Promise<boolean>;
  setQty: (variantId: string, qty: number) => Promise<boolean>;
  remove: (variantId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const { defaultLocale } = useLocaleConfig();
  const locale = params.locale ?? defaultLocale;

  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setCart(await storefront.getCart({ locale }));
    } catch {
      /* API unreachable — keep whatever we had */
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(
    async (op: () => Promise<Cart>): Promise<boolean> => {
      try {
        setCart(await op());
        return true;
      } catch {
        // Refresh so the UI never shows a stale cart after a failed mutation.
        void refresh();
        return false;
      }
    },
    [refresh],
  );

  const add = useCallback(
    (variantId: string, qty = 1) => mutate(() => storefront.addCartItem(variantId, qty, { locale })),
    [mutate, locale],
  );
  const setQty = useCallback(
    (variantId: string, qty: number) =>
      mutate(() => storefront.setCartItemQuantity(variantId, Math.max(1, Math.floor(qty) || 1), { locale })),
    [mutate, locale],
  );
  const remove = useCallback(
    (variantId: string) => mutate(() => storefront.removeCartItem(variantId, { locale })),
    [mutate, locale],
  );

  const count = cart?.itemCount ?? 0;
  const pricedSubtotal = useMemo(
    () => (cart?.items ?? []).reduce((s, l) => s + (lineIsOnRequest(l) ? 0 : l.lineTotal), 0),
    [cart],
  );
  const anyOnRequest = useMemo(() => (cart?.items ?? []).some(lineIsOnRequest), [cart]);

  const value = useMemo<CartValue>(
    () => ({ cart, loading, count, pricedSubtotal, anyOnRequest, add, setQty, remove, refresh }),
    [cart, loading, count, pricedSubtotal, anyOnRequest, add, setQty, remove, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const v = useContext(CartContext);
  if (!v) throw new Error("useCart must be used inside <CartProvider>");
  return v;
}
