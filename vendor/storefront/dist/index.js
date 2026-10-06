var Ge = Object.defineProperty;
var Je = (n, r, s) => r in n ? Ge(n, r, { enumerable: !0, configurable: !0, writable: !0, value: s }) : n[r] = s;
var b = (n, r, s) => Je(n, typeof r != "symbol" ? r + "" : r, s);
const Ye = 4, Ze = "0.6.0";
class P extends Error {
  constructor(s, a) {
    super(s);
    b(this, "status");
    b(this, "code");
    b(this, "body");
    this.name = "StorefrontError", this.status = a.status, this.code = a.code ?? null, this.body = a.body ?? null;
  }
}
const Me = "X-Commerce-Contract-Version", V = "X-CSRF-Token", He = "cms_csrf";
function Qe() {
  if (typeof document > "u" || typeof document.cookie != "string") return null;
  for (const n of document.cookie.split(";")) {
    const r = n.indexOf("=");
    if (r !== -1 && n.slice(0, r).trim() === He)
      return decodeURIComponent(n.slice(r + 1).trim());
  }
  return null;
}
function S(n, r, s) {
  const a = n.replace(/\/+$/, ""), f = r.startsWith("/") ? r : `/${r}`;
  if (!s) return `${a}${f}`;
  const g = new URLSearchParams();
  for (const [h, y] of Object.entries(s))
    if (y != null)
      if (Array.isArray(y))
        for (const O of y) g.append(h, String(O));
      else
        g.set(h, String(y));
  const o = g.toString();
  return o ? `${a}${f}?${o}` : `${a}${f}`;
}
function et(n) {
  const r = n.fetch ?? globalThis.fetch;
  if (typeof r != "function")
    throw new Error(
      "@cms/storefront: no fetch implementation available - pass `fetch` in the config for this runtime."
    );
  const s = n.credentials ?? "include", a = {
    "X-Project-Slug": n.projectSlug,
    [Me]: String(4),
    ...n.headers
  };
  let f = null;
  async function g(e) {
    const t = await o("/api/commerce/customers/csrf", { signal: e });
    return f = t.token, t.token;
  }
  async function o(e, t = {}, c = !1) {
    const u = S(n.apiUrl, e, t.query), d = { ...a, ...t.headers };
    let R;
    t.body !== void 0 && (R = JSON.stringify(t.body), d["Content-Type"] = "application/json");
    const N = (t.method ?? (t.body !== void 0 ? "POST" : "GET")).toUpperCase(), L = N !== "GET" && N !== "HEAD" && !(V in d);
    if (L) {
      let i = Qe() ?? f;
      !i && typeof document < "u" && (i = await g(t.signal).catch(() => null)), i && (d[V] = i);
    }
    let p;
    try {
      p = await r(u, {
        method: t.method ?? (t.body !== void 0 ? "POST" : "GET"),
        headers: d,
        body: R,
        credentials: t.credentials ?? s,
        signal: t.signal
      });
    } catch (i) {
      throw new P(
        `Network request to ${u} failed: ${(i == null ? void 0 : i.message) ?? String(i)}`,
        { status: 0 }
      );
    }
    const $ = await p.text();
    let m = null;
    if ($)
      try {
        m = JSON.parse($);
      } catch {
        m = $;
      }
    if (!p.ok) {
      const i = m && typeof m == "object" && "error" in m ? String(m.error) : null;
      if (L && !c && p.status === 403 && i === "csrf_invalid" && typeof document < "u" && (f = null, await g(t.signal).catch(() => null)))
        return o(e, t, !0);
      throw new P(
        `Request to ${u} failed with ${p.status}${i ? ` (${i})` : ""}`,
        { status: p.status, code: i, body: m }
      );
    }
    return m;
  }
  async function h() {
    return o("/api/commerce/health");
  }
  async function y() {
    const { contractVersion: e } = await h();
    return {
      sdk: 4,
      api: e,
      compatible: e === 4
    };
  }
  function O(e = {}) {
    const t = [];
    if (e.options)
      for (const [u, d] of Object.entries(e.options))
        for (const R of d) t.push(`${u}:${R}`);
    const c = [];
    if (e.attributes)
      for (const [u, d] of Object.entries(e.attributes))
        d.length && c.push(`${u}:${d.join(",")}`);
    return {
      locale: e.locale,
      category: e.category,
      q: e.q,
      type: e.type,
      option: t.length ? t : void 0,
      attribute: c.length ? c : void 0,
      minPrice: e.minPrice,
      maxPrice: e.maxPrice,
      // omit `inStock` unless true (sending "false" would still filter on the server)
      inStock: e.inStock ? !0 : void 0,
      sort: e.sort,
      limit: e.limit,
      offset: e.offset
    };
  }
  async function x(e = {}) {
    return o("/api/commerce/catalog/products", {
      query: O(e),
      signal: e.signal
    });
  }
  async function G(e, t = {}) {
    return o(`/api/commerce/catalog/products/${encodeURIComponent(e)}`, {
      query: { locale: t.locale },
      signal: t.signal
    });
  }
  async function J(e = {}) {
    return (await o("/api/commerce/catalog/categories", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function M(e, t = {}) {
    return o(`/api/commerce/catalog/categories/${encodeURIComponent(e)}`, {
      query: O(t),
      signal: t.signal
    });
  }
  async function H(e = {}) {
    return (await o("/api/commerce/catalog/collections", {
      query: { locale: e.locale },
      signal: e.signal
    })).data;
  }
  async function Q(e, t = {}) {
    return o(`/api/commerce/catalog/collections/${encodeURIComponent(e)}`, {
      query: { locale: t.locale, limit: t.limit },
      signal: t.signal
    });
  }
  function l(e) {
    return e ? { locale: e } : void 0;
  }
  async function K(e = {}) {
    const t = await o(
      "/api/commerce/price-publications",
      { signal: e.signal }
    ), c = n.apiUrl.replace(/\/+$/, "");
    return t.data.map((u) => ({ ...u, url: `${c}${u.path}` }));
  }
  async function B(e = {}) {
    return o("/api/commerce/cart", { query: l(e.locale), signal: e.signal });
  }
  async function X(e, t = 1, c = {}) {
    return o("/api/commerce/cart/items", {
      method: "POST",
      body: { variantId: e, quantity: t },
      query: l(c.locale),
      signal: c.signal
    });
  }
  async function z(e, t, c = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "PUT",
      body: { quantity: t },
      query: l(c.locale),
      signal: c.signal
    });
  }
  async function Y(e, t = {}) {
    return o(`/api/commerce/cart/items/${encodeURIComponent(e)}`, {
      method: "DELETE",
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function Z(e = {}) {
    return o("/api/commerce/cart", { method: "DELETE", query: l(e.locale), signal: e.signal });
  }
  async function ee(e, t = {}) {
    return o("/api/commerce/cart/coupon", {
      method: "POST",
      body: { code: e },
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function te(e, t = {}) {
    const c = e ? `/api/commerce/cart/coupon/${encodeURIComponent(e)}` : "/api/commerce/cart/coupon";
    return o(c, {
      method: "DELETE",
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function ne(e = {}) {
    return o("/api/commerce/cart/shipping", {
      query: { country: e.country, locale: e.locale },
      signal: e.signal
    });
  }
  async function re(e, t = {}) {
    return o("/api/commerce/cart/shipping", {
      method: "PUT",
      body: e,
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function oe(e = {}, t = {}) {
    return o("/api/commerce/pickup-points", {
      query: {
        methodId: e.methodId,
        provider: e.provider,
        country: e.country,
        q: e.q,
        type: e.type,
        limit: e.limit != null ? String(e.limit) : void 0,
        offset: e.offset != null ? String(e.offset) : void 0
      },
      signal: t.signal
    });
  }
  async function ce(e = {}) {
    return o("/api/commerce/checkout", {
      query: l(e.locale),
      signal: e.signal
    });
  }
  async function se(e, t = {}) {
    return o("/api/commerce/checkout", {
      method: "POST",
      body: e,
      query: l(t.locale),
      signal: t.signal
    });
  }
  async function ae(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}`, {
      signal: t.signal
    });
  }
  function ie(e) {
    return S(n.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/invoice.pdf`);
  }
  function ue(e) {
    return S(n.apiUrl, `/api/commerce/orders/${encodeURIComponent(e)}/proforma.pdf`);
  }
  function le(e) {
    return S(n.apiUrl, e);
  }
  async function de(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/accept`, {
      method: "POST",
      signal: t.signal,
      ...t.paymentMethod ? { body: { paymentMethod: t.paymentMethod } } : {}
    });
  }
  async function me(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/decline`, {
      method: "POST",
      signal: t.signal
    });
  }
  async function fe(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/returns`, {
      signal: t.signal
    });
  }
  async function ge(e, t, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/return`, {
      method: "POST",
      body: t,
      signal: c.signal
    });
  }
  async function ye(e = {}) {
    return g(e.signal);
  }
  async function pe(e, t = {}) {
    const c = await o("/api/commerce/customers/register", {
      method: "POST",
      body: e,
      signal: t.signal
    });
    return c && typeof c == "object" && "status" in c && c.status === "set_password_sent" ? { status: "set_password_sent" } : { customer: c.customer };
  }
  async function he(e, t = {}) {
    return (await o("/api/commerce/customers/login", {
      method: "POST",
      body: e,
      signal: t.signal
    })).customer;
  }
  async function Se(e = {}) {
    await o("/api/commerce/customers/logout", {
      method: "POST",
      signal: e.signal
    });
  }
  async function Ce(e = {}) {
    try {
      return (await o("/api/commerce/customers/me", { signal: e.signal })).customer;
    } catch (t) {
      if (t instanceof P && t.status === 401) return null;
      throw t;
    }
  }
  async function Te(e, t = {}) {
    return o(
      `/api/commerce/customers/token/${encodeURIComponent(e)}`,
      { signal: t.signal }
    );
  }
  async function we(e, t = {}) {
    return o("/api/commerce/customers/verify-email", {
      method: "POST",
      body: { token: e },
      signal: t.signal
    });
  }
  async function Oe(e = {}) {
    return o("/api/commerce/customers/resend-verification", {
      method: "POST",
      signal: e.signal
    });
  }
  async function Re(e, t = {}) {
    await o("/api/commerce/customers/forgot-password", {
      method: "POST",
      body: { email: e },
      signal: t.signal
    });
  }
  async function be(e, t, c = {}) {
    return (await o("/api/commerce/customers/reset-password", {
      method: "POST",
      body: { token: e, password: t },
      signal: c.signal
    })).customer;
  }
  async function Ee(e, t, c = {}) {
    await o("/api/commerce/customers/change-password", {
      method: "POST",
      body: { currentPassword: e, newPassword: t },
      signal: c.signal
    });
  }
  async function Ie(e = {}) {
    return (await o("/api/commerce/customers/addresses", {
      signal: e.signal
    })).addresses ?? [];
  }
  async function $e(e, t = {}) {
    return (await o("/api/commerce/customers/addresses", {
      method: "POST",
      body: e,
      signal: t.signal
    })).address;
  }
  async function Pe(e, t, c = {}) {
    return (await o(
      `/api/commerce/customers/addresses/${encodeURIComponent(e)}`,
      { method: "PUT", body: t, signal: c.signal }
    )).address;
  }
  async function ve(e, t = {}) {
    await o(`/api/commerce/customers/addresses/${encodeURIComponent(e)}`, {
      method: "DELETE",
      signal: t.signal
    });
  }
  async function Ue(e = {}) {
    return o("/api/commerce/customers/wishlist", {
      query: { locale: e.locale },
      signal: e.signal
    });
  }
  async function _e(e, t = {}) {
    return (await o("/api/commerce/customers/wishlist", {
      method: "POST",
      body: { productId: e },
      signal: t.signal
    })).productIds ?? [];
  }
  async function ke(e, t = {}) {
    return (await o(
      `/api/commerce/customers/wishlist/${encodeURIComponent(e)}`,
      { method: "DELETE", signal: t.signal }
    )).productIds ?? [];
  }
  async function qe(e, t = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      {
        query: { limit: t.limit != null ? String(t.limit) : void 0, offset: t.offset != null ? String(t.offset) : void 0 },
        signal: t.signal
      }
    );
  }
  async function Ae(e, t, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/reviews`,
      { method: "POST", body: t, signal: c.signal }
    );
  }
  async function Ne(e, t, c = {}) {
    return o(
      `/api/commerce/catalog/products/${encodeURIComponent(e)}/back-in-stock`,
      { method: "POST", body: t, signal: c.signal }
    );
  }
  async function Le(e, t = {}) {
    return o("/api/commerce/consent", {
      method: "POST",
      body: e,
      signal: t.signal
    });
  }
  async function Ve(e = {}) {
    return (await o("/api/commerce/customers/orders", {
      signal: e.signal
    })).orders ?? [];
  }
  async function De(e = {}) {
    return (await o("/api/commerce/customers/oauth/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  function We(e, t = {}) {
    return S(n.apiUrl, `/api/commerce/customers/oauth/${encodeURIComponent(e)}/start`, {
      returnLocale: t.returnLocale
    });
  }
  async function je(e = {}) {
    return (await o("/api/commerce/payments/providers", {
      signal: e.signal
    })).providers ?? [];
  }
  async function Fe(e, t, c = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/pay`, {
      method: "POST",
      body: { provider: t },
      signal: c.signal
    });
  }
  async function xe(e, t = {}) {
    return o(`/api/commerce/orders/${encodeURIComponent(e)}/payment/refresh`, {
      method: "POST",
      signal: t.signal
    });
  }
  return {
    contractVersion: 4,
    request: o,
    health: h,
    checkContract: y,
    listProducts: x,
    getProduct: G,
    listCategories: J,
    getCategory: M,
    listCollections: H,
    getCollection: Q,
    listPricePublications: K,
    getCart: B,
    addCartItem: X,
    setCartItemQuantity: z,
    removeCartItem: Y,
    clearCart: Z,
    applyCoupon: ee,
    removeCoupon: te,
    getShippingMethods: ne,
    setShipping: re,
    searchPickupPoints: oe,
    previewCheckout: ce,
    startCheckout: se,
    getOrder: ae,
    orderInvoicePdfUrl: ie,
    downloadUrl: le,
    orderProformaPdfUrl: ue,
    acceptQuote: de,
    declineQuote: me,
    getReturns: fe,
    requestReturn: ge,
    getCsrfToken: ye,
    register: pe,
    login: he,
    logout: Se,
    getCustomer: Ce,
    getTokenInfo: Te,
    verifyEmail: we,
    resendVerification: Oe,
    forgotPassword: Re,
    resetPassword: be,
    changePassword: Ee,
    listAddresses: Ie,
    createAddress: $e,
    updateAddress: Pe,
    deleteAddress: ve,
    getWishlist: Ue,
    addToWishlist: _e,
    removeFromWishlist: ke,
    listProductReviews: qe,
    submitReview: Ae,
    subscribeBackInStock: Ne,
    recordConsent: Le,
    listMyOrders: Ve,
    listOAuthProviders: De,
    oauthStartUrl: We,
    listPaymentProviders: je,
    initiatePayment: Fe,
    refreshOrderPayment: xe
  };
}
function tt(n) {
  if (!/^\d{11}$/.test(n)) return !1;
  let r = 10;
  for (let a = 0; a < 10; a++)
    r = (r + Number(n[a])) % 10, r === 0 && (r = 10), r = r * 2 % 11;
  return (11 - r) % 10 === Number(n[10]);
}
const v = " - ";
function nt(n, r) {
  const s = n.trim(), a = r.trim();
  return s ? !a || s === a || s.startsWith(`${a}${v}`) || s.endsWith(`${v}${a}`) ? s : `${a}${v}${s}` : a;
}
const _ = "cms_wishlist";
function k() {
  try {
    return typeof localStorage > "u" ? null : localStorage;
  } catch {
    return null;
  }
}
function D() {
  const n = k();
  if (!n) return [];
  try {
    const r = n.getItem(_);
    if (!r) return [];
    const s = JSON.parse(r);
    return Array.isArray(s) ? s.filter((a) => typeof a == "string") : [];
  } catch {
    return [];
  }
}
function W(n) {
  const r = Array.from(new Set(n)), s = k();
  if (s)
    try {
      s.setItem(_, JSON.stringify(r));
    } catch {
    }
  return r;
}
function rt(n) {
  const r = D().filter((s) => s !== n);
  return W([n, ...r]);
}
function ot(n) {
  return W(D().filter((r) => r !== n));
}
function ct() {
  const n = k();
  if (n)
    try {
      n.removeItem(_);
    } catch {
    }
}
const q = "cms-consent-v1";
let C = null, U = !1;
function T() {
  return typeof window < "u" && typeof document < "u";
}
function A() {
  if (!T()) return null;
  try {
    const n = window.localStorage.getItem(q);
    if (!n) return null;
    const r = JSON.parse(n);
    return typeof (r == null ? void 0 : r.analytics) != "boolean" ? null : r;
  } catch {
    return null;
  }
}
function j(n) {
  if (T())
    try {
      const r = {
        ...A(),
        ...n,
        decidedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      window.localStorage.setItem(q, JSON.stringify(r));
    } catch {
    }
}
function st() {
  if (T())
    try {
      window.localStorage.removeItem(q);
    } catch {
    }
}
function F() {
  if (!T() || !C || U) return;
  const n = window;
  n.dataLayer = n.dataLayer || [], typeof n.gtag != "function" && (n.gtag = function() {
    n.dataLayer.push(arguments);
  }), n.gtag("js", /* @__PURE__ */ new Date()), n.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  }), n.gtag("config", C, { anonymize_ip: !0 });
  const r = document.createElement("script");
  r.async = !0, r.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(C)}`, document.head.appendChild(r), U = !0;
}
function at(n) {
  var r;
  C = n || null, C && ((r = A()) == null ? void 0 : r.analytics) === !0 && F();
}
function it() {
  j({ analytics: !0 }), F();
}
function ut() {
  j({ analytics: !1 });
}
function Ke() {
  var n;
  return U && ((n = A()) == null ? void 0 : n.analytics) === !0;
}
function E(n, r) {
  return !T() || !Ke() ? !1 : (window.gtag("event", n, r ?? {}), !0);
}
function w(n) {
  return Math.round(n) / 100;
}
function I(n) {
  return n.map((r) => ({
    item_id: r.id,
    item_name: r.name,
    price: w(r.priceCents),
    quantity: r.quantity ?? 1
  }));
}
function Be(n) {
  return n.reduce((r, s) => r + s.priceCents * (s.quantity ?? 1), 0);
}
function lt(n) {
  return E("view_item", {
    currency: "EUR",
    value: w(n.priceCents),
    items: I([n])
  });
}
function dt(n) {
  return E("add_to_cart", {
    currency: "EUR",
    value: w(n.priceCents * (n.quantity ?? 1)),
    items: I([n])
  });
}
function mt(n, r) {
  return E("begin_checkout", {
    currency: "EUR",
    value: w(r ?? Be(n)),
    items: I(n)
  });
}
function ft(n, r, s) {
  return E("purchase", {
    transaction_id: n,
    currency: "EUR",
    value: w(s),
    items: I(r)
  });
}
export {
  q as CONSENT_STORAGE_KEY,
  Me as CONTRACT_VERSION_HEADER,
  Ye as STOREFRONT_CONTRACT_VERSION,
  Ze as STOREFRONT_SDK_VERSION,
  P as StorefrontError,
  v as TAB_TITLE_SEPARATOR,
  rt as addLocalWishlist,
  ct as clearLocalWishlist,
  st as clearStoredConsent,
  nt as composeTabTitle,
  et as createStorefrontClient,
  ut as denyAnalyticsConsent,
  D as getLocalWishlist,
  A as getStoredConsent,
  it as grantAnalyticsConsent,
  at as initAnalytics,
  Ke as isAnalyticsActive,
  tt as isValidOib,
  ot as removeLocalWishlist,
  W as setLocalWishlist,
  j as storeConsent,
  dt as trackAddToCart,
  mt as trackBeginCheckout,
  E as trackEvent,
  ft as trackPurchase,
  lt as trackViewItem
};
