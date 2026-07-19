var Ne = Object.defineProperty;
var Ae = (t, r, s) => r in t ? Ne(t, r, { enumerable: !0, configurable: !0, writable: !0, value: s }) : t[r] = s;
var O = (t, r, s) => Ae(t, typeof r != "symbol" ? r + "" : r, s);
const xe = 3, Ge = "0.0.1";
class v extends Error {
  constructor(s, a) {
    super(s);
    O(this, "status");
    O(this, "code");
    O(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const Le = "X-Commerce-Contract-Version", N = "X-CSRF-Token", Ve = "cms_csrf";
function De() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const t of document.cookie.split(";")) {
    const r = t.indexOf("=");
    if (r !== -1 && t.slice(0, r).trim() === Ve)
      return decodeURIComponent(t.slice(r + 1).trim());
  }
  return null;
}
function p(t, r, s) {
  const a = t.replace(/\/+$/, ""), o = r.startsWith("/") ? r : `/${r}`;
  if (!s) return `${a}${o}`;
  const f = new URLSearchParams();
  for (const [g, d] of Object.entries(s))
    if (d != null)
      if (Array.isArray(d))
        for (const I of d) f.append(g, String(I));
      else
        f.set(g, String(d));
  const w = f.toString();
  return w ? `${a}${o}?${w}` : `${a}${o}`;
}
function Je(t) {
  const r = t.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available — pass `fetch` in the config for this runtime."
    );
  const s = t.credentials ?? "include", a = {
    "X-Project-Slug": t.projectSlug,
    [Le]: String(3),
    ...t.headers
  };
  async function o(e, n = {}) {
    const c = p(t.apiUrl, e, n.query), l = { ...a, ...n.headers };
    let T;
    n.body !== void 0 && (T = JSON.stringify(n.body), l["Content-Type"] = "application/json");
    const q = (n.method ?? (n.body !== void 0 ? "POST" : "GET")).toUpperCase();
    if (q !== "GET" && q !== "HEAD" && !(N in l)) {
      const i = De();
      i && (l[N] = i);
    }
    let y;
    try {
      y = await r(c, {
        method: n.method ?? (n.body !== void 0 ? "POST" : "GET"),
        headers: l,
        body: T,
        credentials: n.credentials ?? s,
        signal: n.signal
      });
    } catch (i) {
      throw new v(
        `Network request to ${c} failed: ${(i == null ? void 0 : i.message) ?? String(i)}`,
        { status: 0 }
      );
    }
    const P = await y.text();
    let m = null;
    if (P)
      try {
        m = JSON.parse(P);
      } catch {
        m = P;
      }
    if (!y.ok) {
      const i = m && typeof m == "object" && "error" in m ? String(m.error) : null;
      throw new v(
        `Request to ${c} failed with ${y.status}${i ? ` (${i})` : ""}`,
        { status: y.status, code: i, body: m }
      );
    }
    return m;
  }
  async function f() {
    return o("/api/commerce/health");
  }
  async function w() {
    const { contractVersion: e } = await f();
    return {
      sdk: 3,
      api: e,
      compatible: e === 3
    };
  }
  function g(e = {}) {
    const n = [];
    if (e.options)
      for (const [c, l] of Object.entries(e.options))
        for (const T of l) n.push(`${c}:${T}`);
    return {
      locale: e.locale,
      category: e.category,
      q: e.q,
      type: e.type,
      option: n.length ? n : void 0,
      minPrice: e.minPrice,
      maxPrice: e.maxPrice,
      // omit `inStock` unless true (sending "false" would still filter on the server)
      inStock: e.inStock ? !0 : void 0,
      sort: e.sort,
      limit: e.limit,
      offset: e.offset
    };
  }
  async function d(e = {}) {
    return o("/api/commerce/catalog/products", {
      query: g(e),
      signal: e.signal
    });
  }
  async function I(e, n = {}) {
    return o(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: n.locale },
      signal: n.signal
    });
  }
  async function F(e = {}) {
    return (await o("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function W(e, n = {}) {
    return o(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: g(n),
      signal: n.signal
    });
  }
  function u(e) {
    return e ? { locale: e } : void 0;
  }
  async function j(e = {}) {
    return o("/api/commerce/cart", { query: u(e.locale), signal: e.signal });
  }
  async function x(e, n = 1, c = {}) {
    return o("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: n },
      query: u(c.locale),
      signal: c.signal
    });
  }
  async function G(e, n, c = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: n },
      query: u(c.locale),
      signal: c.signal
    });
  }
  async function J(e, n = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function H(e = {}) {
    return o("/api/commerce/cart", { method: "DELETE", query: u(e.locale), signal: e.signal });
  }
  async function Q(e, n = {}) {
    return o("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function K(e, n = {}) {
    const c = e ? `/api/commerce/cart/coupon/${encodeURIComponent(e)}` : "/api/commerce/cart/coupon";
    return o(c, {
      method: "DELETE",
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function M(e = {}) {
    return o("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function X(e, n = {}) {
    return o("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function z(e = {}) {
    return o("/api/commerce/checkout", {
      query: u(e.locale),
      signal: e.signal
    });
  }
  async function B(e, n = {}) {
    return o("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: u(n.locale),
      signal: n.signal
    });
  }
  async function Y(e, n = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: n.signal
    });
  }
  function Z(e) {
    return p(t.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/invoice.pdf`);
  }
  function ee(e) {
    return p(t.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/proforma.pdf`);
  }
  function ne(e) {
    return p(t.apiUrl, e);
  }
  async function te(e, n = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/accept`, {
      method: "POST",
      signal: n.signal
    });
  }
  async function re(e, n = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/decline`, {
      method: "POST",
      signal: n.signal
    });
  }
  async function oe(e, n = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/returns`, {
      signal: n.signal
    });
  }
  async function ce(e, n, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/return`, {
      method: "POST",
      body: n,
      signal: c.signal
    });
  }
  async function se(e = {}) {
    return (await o("/api/commerce/customers/csrf", { signal: e.signal })).token;
  }
  async function ae(e, n = {}) {
    return (await o("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: n.signal
    })).customer;
  }
  async function ie(e, n = {}) {
    return (await o("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: n.signal
    })).customer;
  }
  async function ue(e = {}) {
    await o("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function le(e = {}) {
    try {
      return (await o("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (n) {
      if (n instanceof v && n.status === 401) return null;
      throw n;
    }
  }
  async function me(e, n = {}) {
    return o(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: n.signal }
    );
  }
  async function de(e, n = {}) {
    return o("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: n.signal
    });
  }
  async function fe(e = {}) {
    return o("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function ge(e, n = {}) {
    await o("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: n.signal
    });
  }
  async function ye(e, n, c = {}) {
    return (await o("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: n },
      signal: c.signal
    })).customer;
  }
  async function pe(e, n, c = {}) {
    await o("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: n },
      signal: c.signal
    });
  }
  async function he(e = {}) {
    return (await o("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function Se(e, n = {}) {
    return (await o("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: n.signal
    })).address;
  }
  async function Ce(e, n, c = {}) {
    return (await o(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: n, signal: c.signal }
    )).address;
  }
  async function we(e, n = {}) {
    await o(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: n.signal
    });
  }
  async function Te(e = {}) {
    return o("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function Oe(e, n = {}) {
    return (await o("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: n.signal
    })).productIds ?? [];
  }
  async function Re(e, n = {}) {
    return (await o(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: n.signal }
    )).productIds ?? [];
  }
  async function Ee(e, n = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      {
        query: { limit: n.limit != null ? String(n.limit) : void 0, offset: n.offset != null ? String(n.offset) : void 0 },
        signal: n.signal
      }
    );
  }
  async function Ie(e, n, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      { method: "POST", body: n, signal: c.signal }
    );
  }
  async function Pe(e, n, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/back-in-stock`,
      { method: "POST", body: n, signal: c.signal }
    );
  }
  async function ve(e, n = {}) {
    return o("/api/commerce/consent", {
      method: "POST",
      body: e,
      signal: n.signal
    });
  }
  async function be(e = {}) {
    return (await o("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function Ue(e = {}) {
    return (await o("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function $e(e, n = {}) {
    return p(t.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: n.returnLocale
    });
  }
  async function _e(e = {}) {
    return (await o("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function ke(e, n, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: n },
      signal: c.signal
    });
  }
  async function qe(e, n = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: n.signal
    });
  }
  return {
    contractVersion: 3,
    request: o,
    health: f,
    checkContract: w,
    listProducts: d,
    getProduct: I,
    listCategories: F,
    getCategory: W,
    getCart: j,
    addCartItem: x,
    setCartItemQuantity: G,
    removeCartItem: J,
    clearCart: H,
    applyCoupon: Q,
    removeCoupon: K,
    getShippingMethods: M,
    setShipping: X,
    previewCheckout: z,
    startCheckout: B,
    getOrder: Y,
    orderInvoicePdfUrl: Z,
    downloadUrl: ne,
    orderProformaPdfUrl: ee,
    acceptQuote: te,
    declineQuote: re,
    getReturns: oe,
    requestReturn: ce,
    getCsrfToken: se,
    register: ae,
    login: ie,
    logout: ue,
    getCustomer: le,
    getTokenInfo: me,
    verifyEmail: de,
    resendVerification: fe,
    forgotPassword: ge,
    resetPassword: ye,
    changePassword: pe,
    listAddresses: he,
    createAddress: Se,
    updateAddress: Ce,
    deleteAddress: we,
    getWishlist: Te,
    addToWishlist: Oe,
    removeFromWishlist: Re,
    listProductReviews: Ee,
    submitReview: Ie,
    subscribeBackInStock: Pe,
    recordConsent: ve,
    listMyOrders: be,
    listOAuthProviders: Ue,
    oauthStartUrl: $e,
    listPaymentProviders: _e,
    initiatePayment: ke,
    refreshOrderPayment: qe
  };
}
function He(t) {
  if (!/^\d{11}$/.test(t)) return !1;
  let r = 10;
  for (let a = 0; a < 10; a++)
    r = (r + Number(t[a])) % 10, r === 0 && (r = 10), r = r * 2 % 11;
  return (11 - r) % 10 === Number(t[10]);
}
const U = "cms_wishlist";
function $() {
  try {
    return typeof localStorage > "u" ? null : localStorage;
  } catch {
    return null;
  }
}
function A() {
  const t = $();
  if (!t) return [];
  try {
    const r = t.getItem(U);
    if (!r) return [];
    const s = JSON.parse(r);
    return Array.isArray(s) ? s.filter((a) => typeof a == "string") : [];
  } catch {
    return [];
  }
}
function L(t) {
  const r = Array.from(new Set(t)), s = $();
  if (s)
    try {
      s.setItem(U, JSON.stringify(r));
    } catch {
    }
  return r;
}
function Qe(t) {
  const r = A().filter((s) => s !== t);
  return L([t, ...r]);
}
function Ke(t) {
  return L(A().filter((r) => r !== t));
}
function Me() {
  const t = $();
  if (t)
    try {
      t.removeItem(U);
    } catch {
    }
}
const _ = "cms-consent-v1";
let h = null, b = !1;
function S() {
  return typeof window < "u" && typeof document < "u";
}
function k() {
  if (!S()) return null;
  try {
    const t = window.localStorage.getItem(_);
    if (!t) return null;
    const r = JSON.parse(t);
    return typeof (r == null ? void 0 : r.analytics) != "boolean" ? null : r;
  } catch {
    return null;
  }
}
function V(t) {
  if (S())
    try {
      const r = {
        ...k(),
        ...t,
        decidedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      window.localStorage.setItem(_, JSON.stringify(r));
    } catch {
    }
}
function Xe() {
  if (S())
    try {
      window.localStorage.removeItem(_);
    } catch {
    }
}
function D() {
  if (!S() || !h || b) return;
  const t = window;
  t.dataLayer = t.dataLayer || [], typeof t.gtag != "function" && (t.gtag = function() {
    t.dataLayer.push(arguments);
  }), t.gtag("js", /* @__PURE__ */ new Date()), t.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  }), t.gtag("config", h, { anonymize_ip: !0 });
  const r = document.createElement("script");
  r.async = !0, r.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(h)}`, document.head.appendChild(r), b = !0;
}
function ze(t) {
  var r;
  h = t || null, h && ((r = k()) == null ? void 0 : r.analytics) === !0 && D();
}
function Be() {
  V({ analytics: !0 }), D();
}
function Ye() {
  V({ analytics: !1 });
}
function Fe() {
  var t;
  return b && ((t = k()) == null ? void 0 : t.analytics) === !0;
}
function R(t, r) {
  return !S() || !Fe() ? !1 : (window.gtag("event", t, r ?? {}), !0);
}
function C(t) {
  return Math.round(t) / 100;
}
function E(t) {
  return t.map((r) => ({
    item_id: r.id,
    item_name: r.name,
    price: C(r.priceCents),
    quantity: r.quantity ?? 1
  }));
}
function We(t) {
  return t.reduce((r, s) => r + s.priceCents * (s.quantity ?? 1), 0);
}
function Ze(t) {
  return R("view_item", {
    currency: "EUR",
    value: C(t.priceCents),
    items: E([t])
  });
}
function en(t) {
  return R("add_to_cart", {
    currency: "EUR",
    value: C(t.priceCents * (t.quantity ?? 1)),
    items: E([t])
  });
}
function nn(t, r) {
  return R("begin_checkout", {
    currency: "EUR",
    value: C(r ?? We(t)),
    items: E(t)
  });
}
function tn(t, r, s) {
  return R("purchase", {
    transaction_id: t,
    currency: "EUR",
    value: C(s),
    items: E(r)
  });
}
export {
  _ as CONSENT_STORAGE_KEY,
  Le as CONTRACT_VERSION_HEADER,
  xe as STOREFRONT_CONTRACT_VERSION,
  Ge as STOREFRONT_SDK_VERSION,
  v as StorefrontError,
  Qe as addLocalWishlist,
  Me as clearLocalWishlist,
  Xe as clearStoredConsent,
  Je as createStorefrontClient,
  Ye as denyAnalyticsConsent,
  A as getLocalWishlist,
  k as getStoredConsent,
  Be as grantAnalyticsConsent,
  ze as initAnalytics,
  Fe as isAnalyticsActive,
  He as isValidOib,
  Ke as removeLocalWishlist,
  L as setLocalWishlist,
  V as storeConsent,
  en as trackAddToCart,
  nn as trackBeginCheckout,
  R as trackEvent,
  tn as trackPurchase,
  Ze as trackViewItem
};
