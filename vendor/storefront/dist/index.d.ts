/** Add a product to the guest wishlist (idempotent, moved to newest-first). Returns the new set. */
export declare function addLocalWishlist(productId: string): string[];

export declare interface AnalyticsItem {
    id: string;
    name: string;
    /** Unit price, integer EUR cents. */
    priceCents: number;
    quantity?: number;
}

/** The full cart, returned by every cart endpoint. */
export declare interface Cart {
    id: string;
    token: string;
    currency: "EUR";
    locale: string;
    items: CartLine[];
    itemCount: number;
    /** Applied coupons (L7.7 follow-up — multi-coupon stacking). 0 or 1 for a
     *  non-stackable code; ≥1 all-stackable codes otherwise. */
    coupons: CartCoupon[];
    /** Chosen shipping method + resolved cost + COD (L4.4). */
    shipping: CartShipping;
    totals: CartTotals;
    /** ISO-2 country the totals were taxed at (the cart's ship-to, or "HR" home). */
    taxDestination: string;
    /** false when the shop isn't VAT-registered → no VAT charged (prices are VAT-exempt). */
    vatRegistered: boolean;
    /** true when an APPROVED business customer is logged in → its price list applies
     *  (prices stay GROSS like B2C; only a cross-border EU reverse-charge sale is net). L5.5. */
    b2b: boolean;
    /** true when ≥1 line is a physical product needing a shipment (L9.5). A
     *  digital/service-only cart is false → hide the shipping step, no shipping cost,
     *  no COD offered at checkout. */
    requiresShipping: boolean;
    /** e.g. `"coupon_removed"` when an applied coupon lapsed since it was added. */
    warnings: string[];
}

export declare interface CartCoupon {
    discountId: string;
    code: string | null;
    type: "percentage" | "fixed" | "free_shipping";
    value: number;
    amount: number;
    freeShipping: boolean;
    /** Combinable with other coupons (L7.7 follow-up — multi-coupon stacking). */
    stackable: boolean;
}

export declare interface CartLine {
    variantId: string;
    productId: string;
    sku: string | null;
    name: string;
    slug: string | null;
    /** Locale-resolved option summary of the variant (e.g. "Size: M · Color: Red");
     *  null for an option-less product. Snapshotted onto the order line at checkout. */
    optionsLabel: string | null;
    image: CatalogImage | null;
    taxClass: string;
    /** false = inquiry-only — routes the whole cart to a quote (no payment/delivery); the storefront hides the line price (L7.4). */
    purchasable: boolean;
    /** true for a physical product (needs a shipment); false for digital/service (delivered on payment). L9.5. */
    requiresShipping: boolean;
    quantity: number;
    unitPrice: number;
    regularPrice: number;
    salePrice: number | null;
    onSale: boolean;
    lineTotal: number;
    inventoryTracked: boolean;
    backorder: boolean;
    onHand: number;
    weightGrams: number;
    available: number | null;
    inStock: boolean;
    sellable: boolean;
    maxQuantity: number | null;
}

export declare interface CartShipping {
    country: string;
    zone: ShippingZone;
    method: CartShippingMethod | null;
    amount: number;
    free: boolean;
    freeByCoupon: boolean;
    pickupPoint: PickupPoint | null;
    codEnabled: boolean;
    codSelected: boolean;
    codSurcharge: number;
}

/** The cart's resolved shipping selection (on every cart response). */
export declare interface CartShippingMethod {
    id: string;
    code: string;
    name: string;
    kind: ShippingKind;
    requiresPickupPoint: boolean;
    codAllowed: boolean;
    taxClass: string;
}

/** One row of the per-rate VAT summary (the legally-relevant grouping). */
export declare interface CartTaxSummaryRow {
    rateBps: number;
    net: number;
    vat: number;
    gross: number;
}

/** The single money authority's full breakdown (mirrors `priceOrder()`). */
export declare interface CartTotals {
    currency: "EUR";
    pricesIncludeTax: boolean;
    lines: CartTotalsLine[];
    shipping: null | {
        amount: number;
        taxClass: string;
        rateBps: number;
        net: number;
        vat: number;
        gross: number;
    };
    surcharge: null | {
        amount: number;
        taxClass: string;
        rateBps: number;
        net: number;
        vat: number;
        gross: number;
    };
    itemsSubtotal: number;
    discountTotal: number;
    taxSummary: CartTaxSummaryRow[];
    netTotal: number;
    taxTotal: number;
    grossTotal: number;
    total: number;
}

/** One priced line in the cart totals breakdown. */
export declare interface CartTotalsLine {
    id: string;
    unitPrice: number;
    quantity: number;
    taxClass: string;
    rateBps: number;
    extended: number;
    discount: number;
    net: number;
    vat: number;
    gross: number;
}

export declare interface CatalogBlock {
    type: string;
    data: Record<string, unknown>;
}

export declare interface CatalogCategoryMembership {
    categoryId: string;
    isPrimary: boolean;
    position: number;
}

export declare interface CatalogImage {
    mediaId: string;
    cdnUrl: string;
}

export declare interface CatalogOption {
    id: string;
    name: string;
    label: string;
    position: number;
    values: CatalogOptionValue[];
}

export declare interface CatalogOptionValue {
    id: string;
    value: string;
    label: string;
    /** Display-only price hint (EUR cents, null = none) — e.g. "Medium — €23,90" in
     *  configurator-style pickers. The matched VARIANT price stays the money authority. */
    price: number | null;
    position: number;
}

/** Full product detail for a product page. */
export declare interface CatalogProduct {
    id: string;
    type: string;
    status: string;
    /** false = inquiry-only — price on request, no direct purchase (L7.4). */
    purchasable: boolean;
    locale: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: CatalogImage | null;
    blocks: CatalogBlock[];
    gallery: CatalogImage[];
    options: CatalogOption[];
    variants: CatalogVariant[];
    categories: CatalogCategoryMembership[];
    primaryCategoryId: string | null;
    categoryPath: string[];
    alternates: Record<string, {
        slug: string;
        name: string;
    }>;
    /** true → an approved business is logged in and its price list applies (L5.5).
     *  Prices stay GROSS (VAT-inclusive) like B2C — VAT is itemized only in the cart. */
    b2b: boolean;
    /** Approved-review aggregate (L9.1): `{ count, average }`; average null when no reviews. */
    reviews: {
        count: number;
        average: number | null;
    };
    /** schema.org/Product JSON-LD for rich snippets (inject verbatim into a
     *  `<script type="application/ld+json">`). Added in L2.5. */
    jsonLd: Record<string, unknown>;
}

export declare type CatalogSort = "newest" | "price_asc" | "price_desc" | "name_asc" | "name_desc";

/** A variant on a product-detail response (price + availability resolved). */
export declare interface CatalogVariant {
    id: string;
    productId: string;
    sku: string | null;
    price: number;
    salePrice: number | null;
    effectivePrice: number;
    onSale: boolean;
    compareAt: number | null;
    isDefault: boolean;
    optionValues: Record<string, string>;
    position: number;
    inventoryTracked: boolean;
    backorder: boolean;
    onHand: number;
    available: number | null;
    inStock: boolean;
    sellable: boolean;
    version: number;
}

export declare interface CategoryFacet {
    categoryId: string;
    count: number;
}

export declare interface CategoryLanding {
    category: CategoryNode;
    breadcrumb: {
        id: string;
        slug: string | null;
        label: string | null;
    }[];
    children: CategoryNode[];
    products: ProductCard[];
    total: number;
    limit: number;
    offset: number;
    facets: SearchFacets;
    /** schema.org/CollectionPage JSON-LD for rich snippets. Added in L2.5. */
    jsonLd: Record<string, unknown>;
}

export declare interface CategoryNode {
    id: string;
    parentId: string | null;
    sortOrder: number;
    slug: string | null;
    label: string | null;
    description: string | null;
    heroImage: CatalogImage | null;
    metaTitle: string | null;
    metaDescription: string | null;
}

/**
 * The three PAYABLE checkout modes (L7.4) — the payment method the customer chooses
 * at checkout. INQUIRY (a quote) is the separate `isQuote` flag. `pay_now` = card,
 * `bank_transfer` = proforma / pay-by-invoice, `cod` = cash on delivery.
 */
export declare type CheckoutMode = "pay_now" | "bank_transfer" | "cod";

/** `GET /api/commerce/checkout` — the cart recomputed at the destination tax. */
export declare interface CheckoutPreview {
    /**
     * True when any item is inquiry-only (or per-product checkout modes conflict) → the
     * cart is placed as a quote request (no payment).
     */
    isQuote: boolean;
    /** The full cart view, with totals taxed at the ship-to destination. */
    cart: Cart;
    /**
     * The payable checkout modes offered for this cart (L7.4) — the intersection of its
     * products' required modes, with COD kept only for a COD-eligible shipping method.
     * Empty for a quote, or when no payable method can be offered (e.g. a COD-only
     * product without a COD-eligible shipping method).
     */
    paymentMethods: CheckoutMode[];
    /** The pre-selected mode (shop default if offered, else the first). Null for a quote. */
    defaultPaymentMethod: CheckoutMode | null;
}

/** Clear the guest wishlist entirely (called after a successful merge-to-server). */
export declare function clearLocalWishlist(): void;

/** Forget the stored decision (re-shows the banner on next load). */
export declare function clearStoredConsent(): void;

/** Response of `GET /api/commerce/health` (the public gating probe). */
export declare interface CommerceHealth {
    status: string;
    commerce: true;
    enabled: boolean;
    /** The API's commerce contract version (design §22). */
    contractVersion: number;
}

export declare const CONSENT_STORAGE_KEY = "cms-consent-v1";

/** The visitor's stored cookie-consent decision. */
export declare interface ConsentDecision {
    analytics: boolean;
    /** Marketing opt-in mirrored client-side when captured together (optional). */
    marketing?: boolean;
    /** ISO timestamp of the (latest) decision. */
    decidedAt: string;
}

/** Header the client stamps with its pinned contract version (design §22). */
export declare const CONTRACT_VERSION_HEADER = "X-Commerce-Contract-Version";

/** Result of {@link StorefrontClient.checkContract}. */
export declare interface ContractCheck {
    /** The contract version this SDK is pinned to. */
    sdk: number;
    /** The contract version the API reports. */
    api: number;
    /** `true` when the SDK and API agree on the contract version. */
    compatible: boolean;
}

/** Body for `POST …/customers/addresses`. */
export declare interface CreateAddressInput {
    label?: string;
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    phone?: string;
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
}

/**
 * Create a typed storefront API client (design §17). Framework-agnostic — uses
 * the global `fetch` (override via `config.fetch`). Headless hooks and the
 * payment-client adapters wrap this client in later phases.
 */
export declare function createStorefrontClient(config: StorefrontConfig): StorefrontClient;

/** Response of the CSRF endpoint. */
export declare interface CsrfResponse {
    token: string;
}

/** Approval gate for B2B accounts (L5.5). Only an `approved` business is on B2B terms. */
declare type CustomerApprovalStatus = "none" | "pending" | "approved" | "rejected";

/**
 * A lightweight order summary — one row of the customer's own order history
 * (`GET /api/commerce/customers/orders`, L5.8). Includes prior GUEST orders
 * claimed when the email was verified. `token` links to the full order detail
 * (`getOrder`). Summaries only; fetch `getOrder(token)` for line items + totals.
 */
export declare interface CustomerOrderSummary {
    id: string;
    orderNumber: number;
    token: string;
    placedAt: string;
    status: OrderStatus;
    isQuote: boolean;
    currency: "EUR";
    /** Sum of line quantities. */
    itemCount: number;
    /** Integer EUR cents. */
    grandTotal: number;
}

/** Response wrapper for register/login/me. */
export declare interface CustomerResponse {
    customer: StorefrontCustomer;
}

/** Public token-lookup result (storefront renders the email before acting). */
export declare interface CustomerTokenInfo {
    type: "verification" | "reset";
    email: string;
    expiresAt: string;
}

/** The banner's Decline: store the refusal. Nothing loads; events keep dropping. */
export declare function denyAnalyticsConsent(): void;

/** The guest wishlist product ids (newest first), or `[]` when none/unavailable. */
export declare function getLocalWishlist(): string[];

/** The stored consent decision, or null when the visitor hasn't decided yet
 *  (the storefront shows the cookie banner exactly in the null case). */
export declare function getStoredConsent(): ConsentDecision | null;

/** The banner's Accept: store the grant, then (and only then) load gtag.js. */
export declare function grantAnalyticsConsent(): void;

/**
 * Boot with the shop's GA4 measurement id (null/empty = analytics off). Loads
 * gtag.js immediately IFF the visitor has already granted analytics consent on
 * a previous visit; otherwise nothing happens until `grantAnalyticsConsent()`.
 */
export declare function initAnalytics(id: string | null | undefined): void;

/** Response of `POST /api/commerce/orders/:token/pay`. */
export declare interface InitiatePaymentResult {
    payment: PaymentView;
    initiate: InitiateResult;
}

/** The initiate-payment discriminated union (mirrors the API's `InitiateResult`). */
export declare type InitiateResult = {
    kind: "client_secret";
    clientSecret: string;
    publishableKey: string;
    providerRef: string;
} | {
    kind: "redirect";
    url: string;
    providerRef: string;
};

/** True when events would actually be sent (granted + gtag loaded). */
export declare function isAnalyticsActive(): boolean;

/** True iff `oib` is exactly 11 digits with a valid ISO 7064 MOD 11,10 check digit. */
export declare function isValidOib(oib: string): boolean;

/** Input for `POST /api/commerce/customers/login`. */
export declare interface LoginInput {
    email: string;
    password: string;
}

/** A social-login provider id the storefront can render a button for. */
export declare type OAuthProviderId = "google" | "apple" | "stub";

/** Response of `GET …/customers/oauth/providers`. */
export declare interface OAuthProvidersResponse {
    providers: OAuthProviderId[];
}

/** Options for {@link StorefrontClient.oauthStartUrl}. */
export declare interface OAuthStartOptions {
    /** Locale to return to after the round-trip (lands on `/{locale}/account`). */
    returnLocale?: string;
}

export declare interface OptionFacet {
    name: string;
    label: string;
    values: {
        value: string;
        count: number;
        label: string;
    }[];
}

/** A placed order — returned by `startCheckout` and `getOrder`. */
export declare interface Order {
    id: string;
    orderNumber: number;
    token: string;
    email: string;
    locale: string;
    status: OrderStatus;
    isQuote: boolean;
    /**
     * Quote sub-state (L7.3/L7.5) — `draft | sent | accepted | declined | expired`,
     * null on a normal order. A `sent` quote is the one a customer can accept/decline.
     */
    quoteStatus: string | null;
    /** ISO offer-validity deadline for a quote (L7.3) — null on a normal order. */
    validUntil: string | null;
    currency: "EUR";
    shippingAddress: OrderAddress | null;
    billingAddress: OrderAddress | null;
    shippingMethod: {
        id: string | null;
        code: string;
        name: string;
        kind: ShippingKind;
    } | null;
    pickupPoint: unknown | null;
    codSelected: boolean;
    /** Resolved payable checkout mode (L7.4) — null on a quote. */
    paymentMethod: CheckoutMode | null;
    /** ISO bank-transfer payment deadline (L7.4) — null otherwise. */
    paymentDueAt: string | null;
    taxDestination: string | null;
    items: OrderItem[];
    itemCount: number;
    /** The single money authority's full breakdown (same shape as the cart). */
    totals: CartTotals;
    note: string | null;
    placedAt: string;
    /**
     * Per-line shipped/ordered counts (L7) — present on `getOrder`, so the storefront
     * can show, per item, how much has shipped vs is still to come. Absent on the
     * `startCheckout` response (nothing has shipped yet).
     */
    lineFulfillment?: {
        orderItemId: string;
        ordered: number;
        shipped: number;
        delivered: number;
    }[];
    /**
     * Whether the fiscal receipt/invoice PDF is downloadable (L8.4) — true once the
     * order has a fiscal invoice document (even while the JIR is still pending; the
     * ZKI receipt is valid). Present on `getOrder`; gate `orderInvoicePdfUrl` links
     * on it. The proforma PDF needs no flag — it exists for every bank_transfer order.
     */
    invoiceAvailable?: boolean;
    /**
     * Digital download entitlements (L9.5) — present on `getOrder` once the order
     * is paid and contains digital lines. `url` is an API path; build the absolute
     * link with `downloadUrl(...)`. `licenseKeys` are the keys assigned to this
     * line (may be empty when the shop's pool ran dry).
     */
    downloads?: OrderDownload[];
}

/** A postal address captured at checkout (snapshotted on the order). */
export declare interface OrderAddress {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    /** ISO-3166 alpha-2 — drives destination VAT (OSS) + the shipping zone. */
    country: string;
    phone?: string;
}

/** One digital order line's download entitlement (L9.5). */
export declare interface OrderDownload {
    orderItemId: string;
    name: string;
    filename: string;
    /** API path (`/api/commerce/downloads/:token`) — prefix with the API base. */
    url: string;
    expiresAt: string;
    expired: boolean;
    licenseKeys: string[];
}

/** One snapshotted order line. */
export declare interface OrderItem {
    id: string;
    variantId: string | null;
    productId: string | null;
    sku: string | null;
    name: string;
    optionsLabel: string | null;
    quantity: number;
    taxClass: string;
    rateBps: number;
    unitPrice: number;
    discount: number;
    net: number;
    vat: number;
    gross: number;
    position: number;
}

/** `GET /api/commerce/orders/:token/returns` — the storefront returns view. */
export declare interface OrderReturnsResult {
    eligibility: ReturnEligibility | null;
    returns: ReturnRequest[];
    /** Whether the shop offers web returns at all (L7.6). False → show "email us". */
    returnsEnabled: boolean;
    /** The shop's returns contact address, shown when web returns are off. Null if unset. */
    returnsEmail: string | null;
}

export declare interface OrderStatus {
    /** draft | awaiting_payment | authorized | paid | partially_refunded | refunded | voided */
    paymentStatus: string;
    /** unfulfilled | reserved | preparing | (partially_)shipped | delivered | returned */
    fulfillmentStatus: string;
    /** open | completed | cancelled | quote */
    lifecycle: string;
}

/** The caller's own review (any moderation status) when a customer session is present. */
export declare interface OwnProductReview extends ProductReview {
    status: "pending" | "approved" | "rejected";
}

/** A payment method the storefront can offer (one enabled, configured provider). */
export declare interface PaymentMethodInfo {
    /** Provider id — `"stripe"` (Monri arrives in L6.5). */
    provider: string;
    /** The PUBLISHABLE key (not a secret) — needed client-side to mount Elements. */
    publishableKey: string;
    /**
     * Whether confirming charges immediately (`automatic`) or only AUTHORIZES a hold
     * that's captured later at dispatch (`manual`, L6.4). The storefront uses this to
     * tell the shopper they're placing a hold, not paying yet. Defaults to `automatic`.
     */
    captureMode?: "automatic" | "manual";
}

/** A payment row's public view (the order's charge attempt). */
export declare interface PaymentView {
    id: string;
    orderId: string;
    provider: string;
    status: string;
    flow: string | null;
    currency: "EUR";
    amountAuthorized: number;
    amountCaptured: number;
    amountRefunded: number;
    providerRef: string | null;
    createdAt: string;
    updatedAt: string;
}

/** A chosen parcel-locker / pickup point stored on the cart (carrier-defined). */
export declare interface PickupPoint {
    id?: string;
    name?: string;
    address?: string;
    provider?: string;
    [k: string]: unknown;
}

/** One product as it appears in a listing/grid. */
export declare interface ProductCard {
    id: string;
    type: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    image: CatalogImage | null;
    /** false = inquiry-only — the storefront hides the price ("on request") + offers a "send an inquiry" path instead of buy/checkout (L7.4). */
    purchasable: boolean;
    currency: "EUR";
    /** Min effective B2C GROSS price (VAT-inclusive) across variants (EUR cents) — the "from" price. */
    price: number;
    /** Max effective B2C gross price across variants (EUR cents). */
    priceMax: number;
    /** The cheapest variant's Omnibus compare-at (struck-through reference), or null. */
    compareAt: number | null;
    onSale: boolean;
    inStock: boolean;
    sellable: boolean;
    variantCount: number;
    primaryCategoryId: string | null;
}

/** Query parameters for {@link StorefrontClient.listProducts}. */
export declare interface ProductListParams {
    locale?: string;
    /** Category id or slug — filters to products linked to that category. */
    category?: string;
    /** Full-text query (FTS relevance-ranked). */
    q?: string;
    /** Product type facet filter (physical|digital|service). */
    type?: string;
    /** Option-value facet filters: `{ Color: ["Red","Blue"], Size: ["M"] }` (AND across axes, OR within). */
    options?: Record<string, string[]>;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort?: CatalogSort;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
}

export declare interface ProductListResult {
    data: ProductCard[];
    total: number;
    limit: number;
    offset: number;
    facets: SearchFacets;
}

/** An approved review as the public list returns it. `authorName` null = anonymized author (render "Anonymous"). */
export declare interface ProductReview {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    authorName: string | null;
    verifiedPurchase: boolean;
    createdAt: string;
}

export declare interface ProductReviewsResponse {
    data: ProductReview[];
    total: number;
    summary: ReviewSummary;
    /** The caller's own review (any status); null when none / not logged in. */
    mine: OwnProductReview | null;
    /** True when the caller may submit: verified customer, no prior review, and —
     *  in buyers-only mode — a verified purchase of this product. */
    canReview: boolean;
    /** Shop setting: only buyers may review (submit → 403 `not_a_buyer` otherwise). */
    buyersOnly: boolean;
}

/**
 * Input for `POST /api/commerce/customers/register`. A `business` registration
 * must carry `company` + at least one tax id (`oib` or `vatId`); it is created
 * pending approval and buys at B2C terms until an admin approves it (L5.5).
 */
export declare interface RegisterInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    type?: "personal" | "business";
    company?: string;
    oib?: string;
    vatId?: string;
}

/** Remove a product from the guest wishlist (idempotent). Returns the new set. */
export declare function removeLocalWishlist(productId: string): string[];

/** Body for `POST /api/commerce/orders/:token/return`. */
export declare interface RequestReturnInput {
    /** `quantity` omitted → the whole remaining returnable quantity of the line. */
    lines: {
        orderItemId: string;
        quantity?: number;
    }[];
    reason?: string;
}

/** Result of `POST /resend-verification`. */
export declare interface ResendVerificationResult {
    ok: boolean;
    alreadyVerified?: boolean;
}

/** A line of a delivered order that can still be returned. */
export declare interface ReturnableLine {
    orderItemId: string;
    variantId: string | null;
    name: string;
    sku: string | null;
    ordered: number;
    alreadyReturned: number;
    /** ordered − alreadyReturned. */
    returnable: number;
    /** Line total snapshot (cents). */
    gross: number;
}

/**
 * Whether an order can be returned right now (delivered + inside the window + lines
 * still returnable), with the per-line returnable quantities for building the form.
 */
export declare interface ReturnEligibility {
    eligible: boolean;
    /** When ineligible: not_shipped | window_closed | nothing_returnable. */
    reason: string | null;
    /** The return-window start (ship/fulfilled date) — null when nothing has shipped. */
    windowStartsAt: string | null;
    windowDays: number;
    /** ISO deadline (windowStartsAt + windowDays) — null when nothing has shipped. */
    windowEndsAt: string | null;
    lines: ReturnableLine[];
}

/** A customer return request. `status`: requested → approved | rejected. */
export declare interface ReturnRequest {
    id: string;
    orderId: string;
    status: string;
    reason: string | null;
    adminNote: string | null;
    restock: boolean;
    /** Total cents refunded — items + shipping (null until approved). */
    refundAmount: number | null;
    /** Portion of `refundAmount` that was delivery cost. */
    shippingRefund: number;
    /** `refunded` (a captured payment was returned) | `no_payment` (COD/unpaid). */
    refundOutcome: string | null;
    requestedAt: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    items: ReturnRequestItem[];
}

/** One line of a return request. */
export declare interface ReturnRequestItem {
    id: string;
    orderItemId: string;
    variantId: string | null;
    name: string;
    sku: string | null;
    quantity: number;
    /** Per-line admin decision recorded at approval. */
    refunded: boolean;
    restocked: boolean;
}

export declare interface ReviewSummary {
    count: number;
    average: number | null;
}

export declare interface SearchFacets {
    categories: CategoryFacet[];
    types: TypeFacet[];
    options: OptionFacet[];
    priceRange: {
        min: number;
        max: number;
    } | null;
    inStock: number;
}

/** Overwrite the guest wishlist (de-duplicated, order preserved). Returns the stored set. */
export declare function setLocalWishlist(ids: string[]): string[];

/** Body for `PUT /api/commerce/cart/shipping`. Only present fields are applied. */
export declare interface SetShippingInput {
    methodId?: string | null;
    country?: string | null;
    pickupPoint?: PickupPoint | null;
    codSelected?: boolean;
}

export declare type ShippingKind = "flat" | "weight" | "pickup_point" | "store_pickup";

/** `GET /api/commerce/cart/shipping` — offerable methods + COD config for a zone. */
export declare interface ShippingOptions {
    country: string;
    zone: ShippingZone;
    methods: ShippingRate[];
    cod: {
        enabled: boolean;
        surcharge: number;
    };
}

/** One offerable shipping option with its computed rate for the current cart. */
export declare interface ShippingRate {
    methodId: string;
    code: string;
    name: string;
    kind: ShippingKind;
    requiresPickupPoint: boolean;
    codAllowed: boolean;
    taxClass: string;
    zone: ShippingZone;
    amount: number;
    free: boolean;
}

export declare type ShippingZone = "HR" | "EU" | "INT";

/** Body for `POST /api/commerce/checkout`. */
export declare interface StartCheckoutInput {
    email: string;
    /** Optional: a non-shippable (digital/service-only) cart may send only billing. */
    shippingAddress?: OrderAddress;
    /** Falls back to the shipping address when omitted. */
    billingAddress?: OrderAddress;
    note?: string;
    /**
     * The chosen payable checkout mode (L7.4). Omitted → the resolved default; ignored
     * for a quote. `cod` requires a COD-eligible shipping method + adds the surcharge.
     */
    paymentMethod?: CheckoutMode;
    /**
     * GDPR marketing opt-in (L9.6). Tri-state: omit when the checkbox was never
     * shown/touched (no consent record is written); true/false records the
     * shopper's explicit choice, keyed by the checkout email.
     */
    marketingConsent?: boolean;
}

/** Persist a decision (merges over any previous one; stamps `decidedAt`). */
export declare function storeConsent(decision: {
    analytics: boolean;
    marketing?: boolean;
}): void;

export declare const STOREFRONT_CONTRACT_VERSION: 3;

export declare const STOREFRONT_SDK_VERSION: "0.0.1";

/** A saved postal address (account address book). Fields mirror the checkout address. */
export declare interface StorefrontAddress {
    id: string;
    label: string | null;
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    phone?: string;
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
    createdAt: string;
    updatedAt: string;
}

/** The typed storefront API client. */
export declare interface StorefrontClient {
    /** The contract version this SDK was built against. */
    readonly contractVersion: number;
    /**
     * Low-level typed request helper. Resolves with the parsed JSON body (typed
     * as `T`) or throws {@link StorefrontError}. The domain methods below are thin
     * wrappers over this; it's exposed so projects can reach endpoints the SDK
     * doesn't model yet.
     */
    request<T = unknown>(path: string, init?: StorefrontRequestInit): Promise<T>;
    /** `GET /api/commerce/health` — the public commerce gating probe. */
    health(): Promise<CommerceHealth>;
    /**
     * Fetch the API's contract version and compare it against this SDK's pinned
     * version. Use it on boot to surface a skew warning. Never throws on a
     * mismatch — it reports `{ compatible: false }`.
     */
    checkContract(): Promise<ContractCheck>;
    /** Paginated, filtered, sorted product list. `GET …/catalog/products`. */
    listProducts(params?: ProductListParams): Promise<ProductListResult>;
    /** Product detail by id or per-locale slug. `GET …/catalog/products/:idOrSlug`. */
    getProduct(idOrSlug: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<CatalogProduct>;
    /** Full category tree (flat; nest by parentId). `GET …/catalog/categories`. */
    listCategories(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<CategoryNode[]>;
    /** Category landing (metadata + breadcrumb + children + products). `GET …/catalog/categories/:idOrSlug`. */
    getCategory(idOrSlug: string, params?: ProductListParams): Promise<CategoryLanding>;
    /** Get-or-create + return the current cart. `GET /api/commerce/cart`. */
    getCart(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Add (or increment) a variant. `POST /api/commerce/cart/items`. */
    addCartItem(variantId: string, quantity?: number, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Set a line's absolute quantity (0 removes it). `PUT …/cart/items/:variantId`. */
    setCartItemQuantity(variantId: string, quantity: number, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Remove a line. `DELETE …/cart/items/:variantId`. */
    removeCartItem(variantId: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Clear all lines + the applied coupon. `DELETE /api/commerce/cart`. */
    clearCart(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Apply a coupon code (multiple STACKABLE coupons allowed; L7.7 follow-up).
     *  `POST /api/commerce/cart/coupon`. 400 `not_stackable`/`coupon_already_applied`. */
    applyCoupon(code: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Remove ONE applied coupon by discount id, or ALL when omitted (L7.7 follow-up).
     *  `DELETE /api/commerce/cart/coupon[/:discountId]`. */
    removeCoupon(discountId?: string, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Offerable shipping methods + rates for the cart in a zone. `GET …/cart/shipping`. */
    getShippingMethods(opts?: {
        country?: string;
        locale?: string;
        signal?: AbortSignal;
    }): Promise<ShippingOptions>;
    /** Set the chosen method / country / pickup point / COD. `PUT …/cart/shipping`. */
    setShipping(input: SetShippingInput, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Cart>;
    /** Preview totals at the destination tax + the quote flag. `GET /api/commerce/checkout`. */
    previewCheckout(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<CheckoutPreview>;
    /** Place a pending order (before payment). `POST /api/commerce/checkout`. */
    startCheckout(input: StartCheckoutInput, opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<Order>;
    /** Fetch an order by its public token (the pending-order page). `GET /api/commerce/orders/:token`. */
    getOrder(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<Order>;
    /**
     * URL of the fiscal receipt/invoice PDF (`GET …/orders/:token/invoice.pdf`) —
     * render as a plain download link. 404s until the order is fiscalized; gate on
     * `Order.invoiceAvailable` (from {@link getOrder}).
     */
    orderInvoicePdfUrl(token: string): string;
    /**
     * URL of the bank-transfer proforma (predračun) PDF
     * (`GET …/orders/:token/proforma.pdf`) — bank_transfer orders only (else 404).
     */
    orderProformaPdfUrl(token: string): string;
    /**
     * Accept a SENT quote (keyed by the order token, like {@link getOrder}). Reserves
     * stock + freezes prices + flips the quote to a payable order (then pay via
     * {@link initiatePayment}). 409 `not_acceptable` if the quote isn't in `sent`.
     */
    acceptQuote(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<Order>;
    /** Decline a SENT quote (keyed by the order token). 409 `not_declinable` otherwise. */
    declineQuote(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<Order>;
    /** Return eligibility + existing returns for an order. `GET …/orders/:token/returns`. */
    getReturns(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<OrderReturnsResult>;
    /**
     * Request a return for some of a delivered order's lines (keyed by the order
     * token). 409 `return_not_eligible` (with a `reason`) when out of window / not
     * delivered, or `return_quantity_invalid` for an over-return.
     */
    requestReturn(token: string, input: RequestReturnInput, opts?: {
        signal?: AbortSignal;
    }): Promise<ReturnRequest>;
    /** Fetch a CSRF token (double-submit cookie). Call on boot or before mutations. */
    getCsrfToken(opts?: {
        signal?: AbortSignal;
    }): Promise<string>;
    /** Register a new customer. Auto-logs-in on success. */
    register(input: RegisterInput, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer>;
    /** Log in an existing customer. Sets cookies + merges guest cart. */
    login(input: LoginInput, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer>;
    /** Log out. Clears the auth cookie. */
    logout(opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** Get the current customer, or `null` if not logged in. */
    getCustomer(opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer | null>;
    /** Look up a verification/reset token (renders the email before acting). `GET …/customers/token/:token`. */
    getTokenInfo(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<CustomerTokenInfo>;
    /** Confirm an email-verification token (token-authed, no login needed). `POST …/verify-email`. */
    verifyEmail(token: string, opts?: {
        signal?: AbortSignal;
    }): Promise<VerifyEmailResult>;
    /** Resend the verification email to the logged-in customer. `POST …/resend-verification`. */
    resendVerification(opts?: {
        signal?: AbortSignal;
    }): Promise<ResendVerificationResult>;
    /** Request a password-reset email. Always resolves (anti-enumeration). `POST …/forgot-password`. */
    forgotPassword(email: string, opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** Complete a password reset; auto-logs-in + marks the email verified. `POST …/reset-password`. */
    resetPassword(token: string, password: string, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontCustomer>;
    /** Change the logged-in customer's password (requires a verified email). `POST …/change-password`. */
    changePassword(currentPassword: string, newPassword: string, opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** List the customer's saved addresses (defaults first). `GET …/customers/addresses`. */
    listAddresses(opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontAddress[]>;
    /** Create a saved address. `POST …/customers/addresses`. */
    createAddress(input: CreateAddressInput, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontAddress>;
    /** Update a saved address (PATCH semantics). `PUT …/customers/addresses/:id`. */
    updateAddress(id: string, input: UpdateAddressInput, opts?: {
        signal?: AbortSignal;
    }): Promise<StorefrontAddress>;
    /** Delete a saved address. `DELETE …/customers/addresses/:id`. */
    deleteAddress(id: string, opts?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /** List the wishlist: canonical `productIds` + renderable `products` cards. `GET …/customers/wishlist`. */
    getWishlist(opts?: {
        locale?: string;
        signal?: AbortSignal;
    }): Promise<WishlistResponse>;
    /** Add a product to the wishlist (idempotent). Returns the updated id set. `POST …/customers/wishlist`. */
    addToWishlist(productId: string, opts?: {
        signal?: AbortSignal;
    }): Promise<string[]>;
    /** Remove a product from the wishlist (idempotent). Returns the updated id set. `DELETE …/customers/wishlist/:productId`. */
    removeFromWishlist(productId: string, opts?: {
        signal?: AbortSignal;
    }): Promise<string[]>;
    /** List a product's approved reviews + aggregate. `GET …/catalog/products/:id/reviews`. */
    listProductReviews(productId: string, opts?: {
        limit?: number;
        offset?: number;
        signal?: AbortSignal;
    }): Promise<ProductReviewsResponse>;
    /** Submit a review (starts `pending` until moderated). `POST …/catalog/products/:id/reviews`. */
    submitReview(productId: string, input: SubmitReviewInput, opts?: {
        signal?: AbortSignal;
    }): Promise<SubmitReviewResult>;
    /**
     * Subscribe an email to a variant's restock notification (guests welcome —
     * the email is the identity; no login needed). 409 `in_stock` when the
     * variant is currently available or untracked; `already: true` when this
     * email is already subscribed. `POST …/catalog/products/:id/back-in-stock`.
     */
    subscribeBackInStock(productId: string, input: {
        variantId: string;
        email: string;
        locale?: string;
    }, opts?: {
        signal?: AbortSignal;
    }): Promise<{
        ok: boolean;
        already: boolean;
    }>;
    /**
     * Record a LOGGED-IN customer's consent choice server-side (append-only,
     * source `cookie_banner`). 401 for guests — their banner choice stays
     * client-side; identifiable capture happens at checkout (`marketingConsent`).
     * `POST /api/commerce/consent`.
     */
    recordConsent(input: {
        kind: "analytics" | "marketing";
        granted: boolean;
    }, opts?: {
        signal?: AbortSignal;
    }): Promise<{
        ok: boolean;
    }>;
    /**
     * Absolute URL for a digital download entitlement — pass `OrderDownload.url`
     * (an API path from {@link getOrder}'s `downloads`). Expired links serve 410.
     */
    downloadUrl(path: string): string;
    /** List the customer's own orders (summaries, newest first). `GET …/customers/orders`. */
    listMyOrders(opts?: {
        signal?: AbortSignal;
    }): Promise<CustomerOrderSummary[]>;
    /** Provider ids with a configured + enabled button. `GET …/customers/oauth/providers`. */
    listOAuthProviders(opts?: {
        signal?: AbortSignal;
    }): Promise<OAuthProviderId[]>;
    /**
     * Build the OAuth start URL to navigate the browser to (a full-page redirect,
     * NOT a fetch — cookies + the provider round-trip need a top-level navigation).
     * `GET …/customers/oauth/:provider/start`.
     */
    oauthStartUrl(provider: OAuthProviderId, opts?: OAuthStartOptions): string;
    /** Enabled payment methods + their publishable keys. `GET …/payments/providers`. */
    listPaymentProviders(opts?: {
        signal?: AbortSignal;
    }): Promise<PaymentMethodInfo[]>;
    /**
     * Begin paying a pending order: attaches a payment + returns the initiate union
     * (Stripe: `{ kind: "client_secret" }` → mount Elements). Idempotent per
     * (order, provider). `POST …/orders/:token/pay`.
     */
    initiatePayment(orderToken: string, provider: string, opts?: {
        signal?: AbortSignal;
    }): Promise<InitiatePaymentResult>;
    /**
     * Reconcile + return the order — the server pulls the gateway's payment status
     * (the outbound fallback to the webhook). Poll this on the pending-order page so
     * the status flips even without an inbound webhook tunnel. `POST …/orders/:token/payment/refresh`.
     */
    refreshOrderPayment(orderToken: string, opts?: {
        signal?: AbortSignal;
    }): Promise<Order>;
}

/** Configuration for {@link createStorefrontClient}. */
export declare interface StorefrontConfig {
    /**
     * Base URL of the CMS API (no trailing slash required), e.g.
     * `"https://api.example.com"` or `"http://localhost:3001"`.
     */
    apiUrl: string;
    /**
     * The project slug, sent as the `X-Project-Slug` header on every request —
     * the same header every CMS public endpoint requires.
     */
    projectSlug: string;
    /**
     * Optional `fetch` implementation. Defaults to the global `fetch`. Inject one
     * for SSR runtimes that don't expose a global, or for testing.
     */
    fetch?: typeof fetch;
    /**
     * Credentials mode for requests. Defaults to `"include"` so the customer-auth
     * cookie (added in L5) rides along on same-site-subdomain deployments.
     */
    credentials?: RequestCredentials;
    /** Extra headers merged into every request. */
    headers?: Record<string, string>;
}

/** Wire shape of a customer in API responses. */
export declare interface StorefrontCustomer {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    type: "personal" | "business";
    company: string | null;
    oib: string | null;
    vatId: string | null;
    approvalStatus: CustomerApprovalStatus;
    b2bApproved: boolean;
    emailVerified: boolean;
    createdAt: string;
}

/**
 * Error thrown for any non-2xx API response (or a network/parse failure).
 * Carries the HTTP status, the parsed JSON body when available, and the API's
 * structured `error` code (e.g. `"forbidden_capability"`) when present.
 */
export declare class StorefrontError extends Error {
    readonly status: number;
    readonly code: string | null;
    readonly body: unknown;
    constructor(message: string, opts: {
        status: number;
        code?: string | null;
        body?: unknown;
    });
}

/** Per-call request options. */
export declare interface StorefrontRequestInit {
    method?: string;
    /**
     * Query parameters; `undefined`/`null` values are omitted. An array value is
     * serialized as a repeated key (`?option=a&option=b`).
     */
    query?: Record<string, string | number | boolean | undefined | null | (string | number | boolean)[]>;
    /** JSON request body (serialized; sets `Content-Type: application/json`). */
    body?: unknown;
    /** Extra headers merged into (and overriding) the client defaults. */
    headers?: Record<string, string>;
    signal?: AbortSignal;
    /** Per-call override of the credentials mode. */
    credentials?: RequestCredentials;
}

export declare interface SubmitReviewInput {
    rating: number;
    title?: string | null;
    body?: string | null;
}

export declare interface SubmitReviewResult {
    ok: boolean;
    review: OwnProductReview;
}

/** Add-to-cart. */
export declare function trackAddToCart(item: AnalyticsItem): boolean;

/** Checkout page entered. `totalCents` defaults to the items' sum. */
export declare function trackBeginCheckout(items: AnalyticsItem[], totalCents?: number): boolean;

/**
 * Fire a GA4 event. Returns false (and sends NOTHING) unless the visitor
 * granted analytics consent and gtag is loaded — the consent gate every
 * storefront event goes through.
 */
export declare function trackEvent(name: string, params?: Record<string, unknown>): boolean;

/** Order placed. `transactionId` = the order number/id (dedup key GA-side too). */
export declare function trackPurchase(transactionId: string, items: AnalyticsItem[], totalCents: number): boolean;

/** Product-detail view. */
export declare function trackViewItem(item: AnalyticsItem): boolean;

export declare interface TypeFacet {
    type: string;
    count: number;
}

/** Body for `PUT …/customers/addresses/:id` — every field optional (PATCH); `label: null` clears it. */
export declare type UpdateAddressInput = Partial<Omit<CreateAddressInput, "label">> & {
    label?: string | null;
};

/** Result of `POST /verify-email`. */
export declare interface VerifyEmailResult {
    ok: boolean;
    email: string;
}

/** Result of a wishlist add/remove — the full updated id set (newest first). */
export declare interface WishlistMutationResult {
    ok: boolean;
    productIds: string[];
}

/**
 * Response of `GET …/customers/wishlist`. `productIds` is the canonical set
 * (newest first) — the source of truth for heart/toggle state — and `products`
 * is the renderable subset (cards for products still visible in the locale), in
 * the same order. Server-side; a guest's wishlist lives in localStorage (see the
 * `…LocalWishlist` helpers).
 */
export declare interface WishlistResponse {
    productIds: string[];
    products: ProductCard[];
}

export { }
