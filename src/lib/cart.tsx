import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Client-side shopping cart, persisted in localStorage (no server cart — the
// project has no orders backend yet; checkout collects details in a modal and
// the cart contents are emailed later). One line per `key`: a fixed-price
// product keys on its id; a configurator build keys on id + selected options so
// two different builds of the same product are distinct lines.

export interface CartItem {
  key: string;
  productId: string;
  title: string;
  image: string | null;
  /** Product page URL (for the line-item link). */
  url: string;
  /**
   * Price at add time — fixed price, or a configurator's computed total.
   * `null` = "price on request" (a no-price product added for inquiry); such
   * lines are excluded from `subtotal` and shown as "Na upit".
   */
  unitPrice: number | null;
  qty: number;
  /** Human-readable selected-options summary (configurator builds only). */
  configLabel?: string;
}

interface CartValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
}

const STORAGE_KEY = "linea.cart";
const CartContext = createContext<CartValue | null>(null);

function isCartItem(x: unknown): x is CartItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.key === "string" &&
    typeof o.productId === "string" &&
    typeof o.title === "string" &&
    (typeof o.unitPrice === "number" || o.unitPrice === null) &&
    typeof o.qty === "number"
  );
}

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  // Persist on every change.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [items]);

  // Keep other tabs/windows in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(loadCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.key === item.key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    const q = Math.max(1, Math.floor(qty) || 1);
    setItems((prev) => prev.map((p) => (p.key === key ? { ...p, qty: q } : p)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, p) => s + p.qty, 0);
  // On-request (null-price) lines don't contribute to the money total.
  const subtotal = items.reduce((s, p) => s + (p.unitPrice ?? 0) * p.qty, 0);

  const value = useMemo<CartValue>(
    () => ({ items, count, subtotal, addItem, removeItem, setQty, clear }),
    [items, count, subtotal, addItem, removeItem, setQty, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const v = useContext(CartContext);
  if (!v) throw new Error("useCart must be used inside <CartProvider>");
  return v;
}
