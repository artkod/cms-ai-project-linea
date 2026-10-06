import { ActionIconProps } from '@mantine/core';
import { BadgeProps } from '@mantine/core';
import { ButtonHTMLAttributes } from 'react';
import { ButtonProps as ButtonProps_2 } from '@mantine/core';
import { Component } from 'react';
import { ComponentType } from 'react';
import { CSSProperties } from 'react';
import { DrawerProps } from '@mantine/core';
import { ErrorInfo } from 'react';
import { ForwardRefExoticComponent } from 'react';
import { HTMLAttributes } from 'react';
import { InputHTMLAttributes } from 'react';
import { JSX } from 'react/jsx-runtime';
import { JSXElementConstructor } from 'react';
import { LucideIcon } from 'lucide-react';
import { ModalProps } from '@mantine/core';
import { ReactElement } from 'react';
import { ReactNode } from 'react';
import { ReactPortal } from 'react';
import { RefAttributes } from 'react';
import { TextareaHTMLAttributes } from 'react';

/** The dashed add CTA — the page editor's "Add new section" button, at the
 *  size a field list wants. */
export declare function AddItemButton({ label, onClick, disabled }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}): JSX.Element;

export declare interface AdminConfig {
    apiUrl?: string;
    /**
     * Public base path the admin is served under — pass `import.meta.env.BASE_URL`
     * so it tracks the project's Vite build (`/` in dev, `/admin/` in prod).
     * Drives the URL router (src/router.ts): every screen/editor/tab lives at a
     * real path under this base, so refresh restores the exact location.
     * Admin-base is a prebuilt library and cannot read the consumer's
     * import.meta.env itself. Defaults to `/`.
     */
    basePath?: string;
    /** Identifies this project for the media library. Must match the slug used to configure Bunny CDN in Settings → Media. */
    projectSlug?: string;
    /** Frontend URL for preview mode (e.g. "https://example.com"). Used to build preview links. */
    frontendUrl?: string;
    blockTypes?: BlockTypeDefinition[];
    pageTypes?: PageTypeDefinition[];
    /** Project-specific Settings tabs, appended after the built-in ones. */
    settingsSections?: SettingsSectionDef[];
    /** Project-specific top-level sidebar screens, appended after the built-in nav items. */
    navSections?: NavSectionDef[];
    /**
     * Opt-in commerce/webshop module (design §3). Defaults `false`. Must match the
     * API-side `COMMERCE_ENABLED` flag. When on, later phases lazy-load the
     * commerce admin (Products/Orders/Customers/… nav + settings tabs); off =
     * zero behavioural change for content-only projects.
     */
    commerce?: boolean;
    /**
     * Commerce nav keys to HIDE from this project's admin (sidebar sections + rail
     * tabs). UI-only — the screens stay mounted, this just removes their nav
     * entries; role gating still applies. Section keys: `commerce:sales`,
     * `commerce:catalog`, `commerce:reports`, `commerce:settings`. Tab keys:
     * `commerce:orders`, `commerce:quotes`, `commerce:customers`,
     * `commerce:reviews`, `commerce:products`, `commerce:categories`,
     * `commerce:price-lists`, `commerce:discounts`. Shop-settings TAB keys:
     * `commerce:settings:<tab>` where tab is one of `business`, `tax`, `delivery`,
     * `payments`, `policies`, `notifications`, `fiscalization`, `social`,
     * `search` — hiding tabs lets a project expose the Settings screen with only
     * the tabs it actually uses. Empty/omitted = show all.
     */
    hiddenCommerceNav?: string[];
    /**
     * Commerce FEATURE keys to hide from this project's shop UI — controls, not
     * nav entries, for capabilities the shop doesn't have. Keys: `shipping` (the
     * order detail's Create-shipment card + fulfilment forward-steps), `returns`
     * (the returns policy block + its notification group), `digital` (the digital
     * download block + its notification group). UI-only; server behaviour is
     * unchanged. Empty/omitted = show everything.
     */
    hiddenCommerceFeatures?: string[];
    /**
     * ProductEditor field keys to HIDE from this project's product editor (and
     * force to their canonical value on save, so the attribute can never drift).
     * Per-project product-model lockdown — UI-only otherwise. Keys: `type`
     * (physical/digital/service → forced physical), `sale` (buy/inquiry → forced
     * inquiry-only), `taxClass` (→ forced shop default), `kpdCode` (→ forced
     * empty), `shortDescription` (the per-locale "Alternative title" — hidden
     * only, existing values are left untouched). Empty/omitted = show all fields.
     */
    hiddenProductFields?: string[];
    /**
     * OPT-IN fixed "Product details" schema (DECISIONS 243). Omitted — the
     * default — the product editor keeps core's free-form details editor (add an
     * item, name it, write rich text). Passed, the editor drops the Add-item
     * button and the rich text and renders exactly these named sections of named
     * inputs, so every product in the catalog carries the same fields. Values are
     * stored in the existing per-locale `detailTabs` (one tab per section,
     * `content = { kind: "fields", fields: [{ key, label, value }] }`), so the
     * storefront reads them off `CatalogProduct.detailTabs` with no contract
     * change. Section `id`s and field `key`s are stable identifiers — renaming one
     * orphans the values already stored under it.
     */
    productDetailSections?: ProductDetailSectionDef[];
    /**
     * Per-locale overrides for admin UI copy, merged over the built-in bundles:
     * `{ en: { "commerce.products.detailTabs": "Product items" } }`. For a project
     * that renames a concept — never for translations that belong upstream.
     */
    i18nOverrides?: Record<string, Record<string, string>>;
}

export declare function AppDrawer({ title, description, children, footer, onConfirm, confirmLabel, confirmDisabled, destructive, loading, cancelLabel, dirty, onClose, size, ...rest }: AppDrawerProps): JSX.Element;

export declare interface AppDrawerProps extends Omit<DrawerProps, "title" | "position" | "withCloseButton"> {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    onConfirm?: () => void;
    confirmLabel?: ReactNode;
    confirmDisabled?: boolean;
    destructive?: boolean;
    loading?: boolean;
    cancelLabel?: ReactNode;
    /**
     * When true, closing the drawer (Esc, overlay click, X, Cancel) first asks
     * "Discard unsaved changes?" instead of silently dropping the edits. The
     * caller owns the dirty computation.
     */
    dirty?: boolean;
}

export declare function AppModal({ title, subject, description, intent, icon, children, footer, footerHint, onConfirm, confirmLabel, destructive, confirmDisabled, loading, cancelLabel, onClose, size, centered, lockBackdrop, opened, ...rest }: AppModalProps): JSX.Element;

export declare interface AppModalProps extends Omit<ModalProps, "title" | "withCloseButton" | "size"> {
    /** Modal title — required. */
    title: ReactNode;
    /**
     * Optional one-line subject — the noun the action is about (file name,
     * page title, key name). Renders below the title in smaller weight.
     */
    subject?: ReactNode;
    /** Optional longer description shown in the body, muted. */
    description?: ReactNode;
    /**
     * Intent — drives the leading icon tint and default glyph.
     * Default: undefined → no leading icon.
     */
    intent?: "danger" | "warning" | "brand" | "info";
    /** Custom icon — overrides the default-by-intent glyph. */
    icon?: ReactNode;
    /** Body content. */
    children?: ReactNode;
    /** Optional left-side hint in the footer. */
    footerHint?: ReactNode;
    /** Custom footer. If omitted and onConfirm is set, a default footer renders. */
    footer?: ReactNode;
    onConfirm?: () => void;
    confirmLabel?: ReactNode;
    /** When true the confirm uses danger variant. Defaults to intent==="danger". */
    destructive?: boolean;
    /** Disable the confirm button. */
    confirmDisabled?: boolean;
    loading?: boolean;
    cancelLabel?: ReactNode;
    /** Size token. Default: "md". */
    size?: "sm" | "md" | "lg" | "xl";
    /**
     * When true backdrop clicks are ignored.
     * Defaults to intent==="danger" — prevents fat-finger deletes.
     */
    lockBackdrop?: boolean;
}

declare function Banner({ tone, title, children, icon, action, onClose, closeLabel, style }: BannerProps): JSX.Element;

declare interface BannerProps {
    tone?: BannerTone;
    title?: ReactNode;
    children?: ReactNode;
    icon?: LucideIcon;
    action?: ReactNode;
    onClose?: () => void;
    /** Accessible label for the dismiss button (pass t("common.dismiss")). */
    closeLabel?: string;
    style?: CSSProperties;
}

declare type BannerTone = "info" | "success" | "warn" | "danger";

declare function BarChart({ buckets, seriesLabels, height, orientation, format, emptyLabel, labelCase, fill, onBucketClick, style, }: BarChartProps): JSX.Element;

declare interface BarChartBucket {
    /** Axis label under the bar (vertical) or beside it (horizontal). */
    label: string;
    /** One value per series; length 1 or 2. */
    values: number[];
    /** Current/most-recent bucket — paints teal when single-series, bolds the label. */
    active?: boolean;
}

declare interface BarChartProps {
    buckets: BarChartBucket[];
    /** Series names for the legend + tooltip rows. Omit = no legend. */
    seriesLabels?: string[];
    /** Track height in px (vertical only; horizontal sizes to its rows). Default 140. */
    height?: number;
    orientation?: "vertical" | "horizontal";
    /** Value formatter for tooltips + horizontal row values. Default String(n). */
    format?: (n: number) => string;
    /** Rendered centered in the track when every bucket is zero/absent. */
    emptyLabel?: string;
    /**
     * `vertical` only. Axis labels default to the small tracked-uppercase idiom,
     * which suits the DATE labels every spark chart carries ("JUN 26"). A chart
     * whose buckets are WORDS reads as shouting in that style, so those pass
     * `"normal"` to get the same treatment the horizontal rows already use
     * (kit round 19).
     */
    labelCase?: "upper" | "normal";
    /**
     * `horizontal` only: spread the rows over the available height (thicker bars,
     * roomier type) instead of stacking them at their natural size. For a chart
     * that has to fill a tall card beside a long list.
     */
    fill?: boolean;
    onBucketClick?: (index: number) => void;
    style?: CSSProperties;
}

declare interface BaseFieldProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
}

export declare interface BlockEditorProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
    /** Position of this block in the page editor. Used by Mixed Content for cross-block DnD. */
    blockIdx?: number;
}

export declare interface BlockTypeDefinition {
    type: string;
    label: string;
    defaultData: Record<string, unknown>;
    EditorComponent: ComponentType<BlockEditorProps>;
    /** Optional: derive a display label from block data (e.g. user-set title). Falls back to `label`. */
    getLabel?: (data: Record<string, unknown>) => string;
    /**
     * Declare which parts of this block's data are prose, for AI translation
     * (DECISIONS 249). Paths are relative to the data object passed in. Without
     * it core guesses with `heuristicTranslatable`, which conservatively skips
     * anything that looks like an id, a URL or a code — so declare the hook when
     * a text field of yours is a short word the guesser would mistake for one.
     */
    translatable?: TranslatableHook;
}

declare function Breadcrumb({ items, onNavigate, style }: BreadcrumbProps): JSX.Element;

declare interface BreadcrumbItem {
    label: ReactNode;
    href?: string;
    icon?: LucideIcon;
}

declare interface BreadcrumbProps {
    items: BreadcrumbItem[];
    onNavigate?: (item: BreadcrumbItem, index: number) => void;
    style?: CSSProperties;
}

export declare const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;

declare function Button_2({ variant, size, icon: Icon, disabled, fullWidth, children, style, type, ...rest }: ButtonProps_3): JSX.Element;

export declare interface ButtonProps extends Omit<ButtonProps_2, "variant" | "color"> {
    /** Intent of the button — see file header for guidance. Defaults to `secondary`. */
    variant?: ButtonVariant;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    type?: "button" | "submit" | "reset";
}

declare interface ButtonProps_3 extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
    variant?: ButtonVariant_2;
    size?: ButtonSize;
    icon?: LucideIcon;
    fullWidth?: boolean;
    children?: React.ReactNode;
}

declare type ButtonSize = "sm" | "md" | "lg";

/**
 * Canonical Button — the ONLY way to render a button in @cms/admin-base.
 *
 * Five intents, mapped onto Mantine variants so we don't reinvent rendering:
 *
 *   variant       use for                                  example
 *   ───────────────────────────────────────────────────────────────────────
 *   primary       single CTA per surface                   "Publish page", "New page", "Save changes"
 *   secondary     safe & common actions, pair w/ primary   "Save", "Cancel", "Preview"
 *   ghost         tertiary, dense action rows              "Save as template" inside the editor
 *   danger        destructive PRIMARY (always confirmed)   "Move to trash", "Delete forever"
 *   danger-ghost  destructive tertiary                     "Discard changes", "Remove favicon"
 *
 * Cancel is ALWAYS `variant="secondary"` — never a text link, never `subtle`.
 * The compiler will tell you if you try anything else.
 */
export declare type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";

declare type ButtonVariant_2 = "primary" | "cta" | "secondary" | "tinted" | "ghost" | "danger" | "danger-soft";

declare function Card({ variant, interactive, style, children, ...rest }: CardProps): JSX.Element;

declare interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    interactive?: boolean;
}

declare type CardVariant = "surface" | "panel" | "list";

export declare function CategoryPicker({ value, onChange, label, required, hint }: CategoryPickerProps): JSX.Element;

export declare interface CategoryPickerProps {
    /** The chosen category id, or null. */
    value: string | null;
    onChange: (id: string | null) => void;
    label?: string;
    required?: boolean;
    hint?: string;
}

declare function Checkbox({ checked, onChange, label, size, disabled, style }: CheckboxProps): JSX.Element;

declare interface CheckboxProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    label?: ReactNode;
    size?: number;
    disabled?: boolean;
    style?: CSSProperties;
}

declare function Chip({ children, onRemove, removeLabel, size, style }: ChipProps): JSX.Element;

declare interface ChipProps {
    children: ReactNode;
    onRemove: () => void;
    /** Accessible name of the remove action, e.g. "Remove filter Payment: Paid". */
    removeLabel: string;
    size?: "sm" | "md";
    style?: CSSProperties;
}

export declare function ChipsInput({ values, onChange, options, addLabel, removeLabel, formatValue, requireOne, disabled, }: ChipsInputProps): JSX.Element;

export declare interface ChipsInputOption {
    value: string;
    label: string;
}

export declare interface ChipsInputProps {
    values: string[];
    onChange: (values: string[]) => void;
    /** Fixed option list — switches the add affordance to a Menu. */
    options?: ChipsInputOption[];
    /** Label text for the Menu trigger / placeholder for the free-text input. */
    addLabel: string;
    /** aria-label template for a chip's remove button; `{{value}}` is replaced. */
    removeLabel?: string;
    /** Render `values` through this before display (option labels, locale names). */
    formatValue?: (value: string) => string;
    /** Refuse to remove the last remaining chip (Locales needs ≥1). */
    requireOne?: boolean;
    /** Read-only: chips render without their remove button and no add affordance. */
    disabled?: boolean;
}

export declare function CollectionPicker({ value, onChange, label, required, hint }: CollectionPickerProps): JSX.Element;

export declare interface CollectionPickerProps {
    /** The chosen collection `code`, or null. */
    value: string | null;
    onChange: (code: string | null) => void;
    label?: string;
    required?: boolean;
    hint?: string;
}

export declare function computeLinkHref(data: Partial<LinkData>): string | null;

export declare class ConflictError extends Error {
    constructor(message?: string);
}

declare interface ContentLocaleContextValue {
    locale: string;
    setLocale: (next: string) => void;
    availableLocales: string[];
    defaultLocale: string;
    ready: boolean;
    refresh: () => Promise<void>;
}

export declare function ContentLocaleProvider({ children }: {
    children: ReactNode;
}): JSX.Element;

export declare function createAdmin(config?: AdminConfig): void;

declare interface DraftSnapshot {
    title: string;
    slug: string;
    typeData: Record<string, unknown>;
    blocks: Array<{
        type: string;
        data: Record<string, unknown>;
    }>;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImageUrl: string | null;
    canonicalUrl: string | null;
    noindex: boolean;
    publishAt: string | null;
}

declare function Drawer({ open, onClose, side, width, maxHeight, height, resizable, zIndex, expandLabel, collapseLabel, children, style, }: DrawerProps_2): ReactPortal | null;

declare function DrawerBody({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare function DrawerFooter({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare function DrawerHeader({ icon: Icon, title, subtitle, badge, closeLabel, onClose }: DrawerHeaderProps): JSX.Element;

declare interface DrawerHeaderProps {
    icon?: LucideIcon;
    title: ReactNode;
    subtitle?: ReactNode;
    badge?: ReactNode;
    /** Accessible label for the close button (pass t("common.close")). */
    closeLabel: string;
    onClose?: () => void;
}

declare interface DrawerProps_2 {
    open?: boolean;
    onClose?: () => void;
    side?: "right" | "bottom";
    width?: number;
    /** Bottom sheets: content-height cap before the body scrolls. */
    maxHeight?: string;
    /** Bottom sheets: fixed height (e.g. "72%") — content-heavy editors; default fit-content. */
    height?: string;
    /** Bottom sheets: full-screen toggle in the header. */
    resizable?: boolean;
    /** Stacking override (scrim z; panel z+1) — a sheet opened ABOVE a kit
     *  Modal needs this, since --z-drawer (41) sits under --z-modal (100). */
    zIndex?: number;
    /** Accessible labels for the resize toggle (pass translated strings). */
    expandLabel?: string;
    collapseLabel?: string;
    children: ReactNode;
    style?: CSSProperties;
}

/** The body of a card holding several `FieldSection`s. */
export declare function EditorPanel({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

export declare function EmptyState({ icon: Icon, title, description, actions, compact, }: EmptyStateProps): JSX.Element;

declare function EmptyState_2({ icon: Icon, title, description, action, variant, style }: EmptyStateProps_2): JSX.Element;

/**
 * Canonical empty-state — used for "No X yet" sections.
 *
 * The screenshots showed 3+ different empty-state patterns across the admin:
 *   - WebhooksManager:   "No webhooks configured" + "Add your first webhook" text link
 *   - ApiKeyManager:     "No API keys yet." — bare text, no action
 *   - StringsManager:    "No strings defined for this language yet." + "+ Add string" link
 *   - MenuEditor:        "No published pages match the selected types." — bare text
 *
 * This component is the one shape for all of them:
 *   icon  ·  title  ·  description  ·  action button(s)
 */
export declare interface EmptyStateProps {
    /** Lucide icon component — pass it as a reference, not as JSX. */
    icon?: LucideIcon;
    /** Title — single short line, semibold. */
    title: ReactNode;
    /** Description — 1–2 lines, muted. */
    description?: ReactNode;
    /**
     * Action node(s) — pass a Button or Group of buttons. The component does NOT
     * inject a default action; this is deliberate so each empty state can decide
     * which action is most useful (Add, Refresh, Go to settings, etc.).
     */
    actions?: ReactNode;
    /** Optional extra padding when used inside a small card. */
    compact?: boolean;
}

declare interface EmptyStateProps_2 {
    icon?: LucideIcon;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    variant?: "plain" | "dashed";
    style?: CSSProperties;
}

export declare class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    render(): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | JSX.Element | null | undefined;
}

export declare function fetchProjectSettings<T = Record<string, unknown>>(key: string): Promise<ProjectSettings<T>>;

/** A labelled field wrapper — for composite controls (pickers) that are not a
 *  kit Input. A plain input uses its own `label` prop and needs no wrapper. */
export declare function Field({ label, required, hint, error, children, }: {
    label?: ReactNode;
    required?: boolean;
    hint?: ReactNode;
    error?: ReactNode;
    children: ReactNode;
}): JSX.Element;

export declare interface FieldDef {
    name: string;
    label: string;
    type: FieldType;
    /** Static option list for `select` fields. */
    options?: string[];
    /**
     * For `select` fields: load the option list dynamically from a project-settings
     * key (`GET /api/project-settings/:key`) instead of the static `options` array.
     * The stored value should be `{ options: string[] }` (a bare `string[]` is also
     * accepted). `options` is used as the fallback while loading or on error. Lets a
     * project expose an admin-managed list (e.g. a "Settings → Article" tag editor) as
     * a page-type field dropdown without redeploying.
     */
    optionsSource?: string;
    required?: boolean;
    placeholder?: string;
}

/** Standalone explainer paragraph. */
export declare function FieldHint({ children, error }: {
    children: ReactNode;
    error?: boolean;
}): JSX.Element;

/**
 * One bordered item shell: a sunken header (optional index + title + actions)
 * over a body of fields. `Repeater` draws its rows with it, and a section with a
 * FIXED number of sub-groups (three process steps, two makers) uses it directly
 * — a nested `FieldSection` rule would carry the same weight as its parent and
 * read as a sibling section.
 */
export declare function FieldItem({ title, index, actions, collapsed, children, }: {
    title: ReactNode;
    /** 1-based; rendered as the mono `01` marker. */
    index?: number;
    actions?: ReactNode;
    /** Header-only (no body border) — set by `Repeater` when a row is closed. */
    collapsed?: boolean;
    children?: ReactNode;
}): JSX.Element;

/**
 * A row of fields. `auto` (the default) reflows to as many columns as fit,
 * `2` is a fixed pair, `line` keeps every field on ONE line however many there
 * are (the fixed product-details spec row). All three collapse on mobile.
 */
export declare function FieldRow({ cols, children }: {
    cols?: "auto" | 2 | "line";
    children: ReactNode;
}): JSX.Element;

/**
 * One group inside a panel: a tracked uppercase rule, an optional explainer,
 * then the fields. A section is never its own card — the rule is what separates
 * it from the next one, exactly as on the product-details screen.
 */
export declare function FieldSection({ title, hint, right, children, }: {
    title: ReactNode;
    hint?: ReactNode;
    right?: ReactNode;
    children: ReactNode;
}): JSX.Element;

export declare type FieldType = "text" | "textarea" | "number" | "select" | "date" | "image-url" | "icon" | "link";

export declare interface GalleryImage {
    mediaId: string;
    cdnUrl: string;
    /** Original filename — populated by the picker; useful for document refs. */
    name?: string;
    /** File size in bytes — populated by the picker. */
    size?: number;
    /** MIME type — populated by the picker. */
    mimeType?: string;
}

/** Resolve a stored icon name to its lucide component, or null if unknown. */
export declare function getLucideIcon(name: string | null | undefined): LucideIcon | null;

/**
 * Best-effort extraction from a shape core does not know. Recurses objects and
 * arrays, honours the deny-list, and recognises the three value shapes core
 * hands projects: a picked image, a link, and a rich-text document.
 */
export declare function heuristicTranslatable(data: unknown, base?: TranslatablePath): TranslatableRef[];

export declare const IconButton: ForwardRefExoticComponent<IconButtonProps & RefAttributes<HTMLButtonElement>>;

declare function IconButton_2({ icon: Icon, label, variant, size, iconSize, active, noTooltip, style, type, ...rest }: IconButtonProps_2): JSX.Element;

export declare interface IconButtonProps extends Omit<ActionIconProps, "variant" | "color" | "aria-label"> {
    variant?: IconButtonVariant;
    /** Required — used as both aria-label and tooltip text. */
    label: string;
    /** Set false to skip the tooltip wrapper. Defaults to true. */
    withTooltip?: boolean;
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

declare interface IconButtonProps_2 extends ButtonHTMLAttributes<HTMLButtonElement> {
    icon: LucideIcon;
    label: string;
    variant?: IconButtonVariant_2;
    /** Square size in px: 24 inline / 28 default / 30 modal close / 36 mobile. */
    size?: number;
    iconSize?: number;
    active?: boolean;
    /** Suppress the tooltip (aria-label kept). */
    noTooltip?: boolean;
}

/**
 * Canonical IconButton — the ONLY way to render an icon-only button.
 *
 *   variant     use for
 *   ─────────────────────────────────────────────────────────────────────
 *   ghost       default, sits inline in dense rows (table actions, etc.)
 *   bordered    floating / docked actions (action bar in PageEditor)
 *   danger      destructive (Trash2). Confirms via ConfirmModal.
 *
 * `label` is required — renders as `aria-label` AND as a Tooltip,
 * so we never have a mystery icon. Pass the same string to both.
 */
export declare type IconButtonVariant = "ghost" | "bordered" | "danger";

declare type IconButtonVariant_2 = "ghost" | "bordered" | "teal" | "danger" | "danger-soft";

export declare function IconPicker({ value, onChange, label, required, modalTitle }: IconPickerProps): JSX.Element;

export declare function IconPickerModal({ opened, onClose, value, onConfirm, title, }: IconPickerModalProps): JSX.Element;

export declare interface IconPickerModalProps {
    opened: boolean;
    onClose: () => void;
    /** Currently selected icon name (PascalCase), if any. */
    value?: string | null;
    /** Called with the chosen icon name. */
    onConfirm: (name: string) => void;
    /** Modal title. Defaults to the localized "Select an icon". */
    title?: string;
    /** @deprecated Accepted for backward compatibility; the kit owns overlay z-order. */
    zIndex?: number;
}

export declare interface IconPickerProps {
    /** Currently selected icon name (PascalCase), or null. */
    value: string | null;
    onChange: (name: string | null) => void;
    /** Label shown above the control. */
    label?: string;
    required?: boolean;
    /** Title for the picker modal. */
    modalTitle?: string;
}

/** One image chosen from the media library. Stores the picker's reference, so
 *  the media-usage scan can see the page using the file. */
export declare function ImageField({ label, value, onChange, required, hint, disabled, }: {
    label?: string;
    value: GalleryImage | null;
    onChange: (image: GalleryImage | null) => void;
    required?: boolean;
    hint?: string;
    disabled?: boolean;
}): JSX.Element;

export declare function ImagePickerModal({ opened, onClose, title, mode, fileType, initialImages, onConfirm, }: ImagePickerModalProps): JSX.Element;

export declare interface ImagePickerModalProps {
    opened: boolean;
    onClose: () => void;
    /** Modal title */
    title?: string;
    /**
     * "single" — one selection at a time, confirmed via the footer button.
     * "multi"  — marquee + checkmarks + explicit Confirm button.
     */
    mode: "single" | "multi";
    /**
     * Which media kind to browse:
     *   "image"    — raster images (default; legacy behaviour).
     *   "document" — non-image files (PDFs, etc.), rendered as file-icon tiles.
     */
    fileType?: "image" | "document";
    /** Pre-selected images shown with checkmarks on open (ignored in single mode). */
    initialImages?: GalleryImage[];
    onConfirm: (images: GalleryImage[]) => void;
    /** Legacy stacking override — kit overlays share one z-scale; kept for API compat. */
    zIndex?: number;
}

declare function Input({ label, hint, error, icon: Icon, mono, rows, fullWidth, action, stepper, onStep, style, inputStyle, autoComplete, ...rest }: InputProps): JSX.Element;

declare interface InputProps extends Omit<NativeProps, "style"> {
    label?: ReactNode;
    hint?: ReactNode;
    /** Truthy = error state; a string renders as the error message. */
    error?: ReactNode | boolean;
    icon?: LucideIcon;
    mono?: boolean;
    /** Render a textarea with this many rows. */
    rows?: number;
    fullWidth?: boolean;
    /**
     * Trailing control rendered INSIDE the field box (kit round 13) — the
     * prototype's masked secret row puts its reveal eye there, so a password
     * field stays exactly as wide as every other field in the form.
     */
    action?: ReactNode;
    /**
     * Kit round 18 — numeric stepper: a `−` and a `+` control INSIDE the box with
     * the value centred between them, for small quantity fields where clicking
     * beats typing. Pair with `onStep`; `min`/`max`/`step` are the native props
     * and bound the arrows (a control at its bound renders disabled).
     */
    stepper?: boolean;
    /**
     * Called when an arrow is pressed with the clamped next value AND the signed
     * step. `next` is computed from the CURRENT `value` prop, so a consumer whose
     * state could be a render behind (a burst of clicks inside one React batch)
     * should apply `delta` through a state updater instead.
     */
    onStep?: (next: number, delta: number) => void;
    style?: CSSProperties;
    inputStyle?: CSSProperties;
}

export declare function isLinkDataValid(d: LinkData): boolean;

declare interface LangRowOption {
    code: string;
    label: ReactNode;
    on: boolean;
    /** Optional hover hint for the whole row (kit Tooltip). */
    tooltip?: string;
}

declare function LangRows({ title, langs, onToggle, style }: {
    title: ReactNode;
    langs: LangRowOption[];
    onToggle?: (code: string) => void;
    style?: CSSProperties;
}): JSX.Element;

declare function LangSwitch({ langs, value, onChange, style }: {
    langs: LangSwitchOption[];
    value?: string;
    onChange?: (code: string) => void;
    style?: CSSProperties;
}): JSX.Element;

declare interface LangSwitchOption {
    code: string;
    label: ReactNode;
}

export declare interface LinkData {
    linkType: LinkType;
    pageId?: string;
    pageSlug?: string;
    pageTitle?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileMimeType?: string;
    fileMediaId?: string;
    url?: string;
    openInNewTab?: boolean;
    email?: string;
    emailSubject?: string;
    linkText?: string;
    tooltip?: string;
    asButton: boolean;
    buttonSize: string;
    buttonType: string;
    buttonPosition: string;
}

/**
 * A link target (page / URL / e-mail / file) picked through the shared link
 * picker, with the link TEXT captured alongside — the same data the Mixed
 * Content link widget stores, so a storefront renderer stays interchangeable.
 */
export declare function LinkField({ label, value, onChange, required, hint, disabled, }: {
    label?: string;
    value: LinkData | null;
    onChange: (link: LinkData | null) => void;
    required?: boolean;
    hint?: string;
    disabled?: boolean;
}): JSX.Element;

export declare function LinkPickerModal({ opened, onClose, mode, initialData, onConfirm, currentLocale, showTextFields, }: LinkPickerModalProps): JSX.Element;

declare interface LinkPickerModalProps {
    opened: boolean;
    onClose: () => void;
    /** "widget" = full form with button options; "rte" = link fields only */
    mode: "widget" | "rte";
    initialData?: Partial<LinkData>;
    onConfirm: (data: LinkData) => void;
    /** Legacy stacking override — kit overlays share one z-scale; kept for API compat. */
    zIndex?: number;
    /** Show the "Link text" + "Tooltip text" fields even in "rte" mode. */
    showTextFields?: boolean;
    /**
     * Locale the link is being authored in. When set, the "page" picker hides
     * pages whose translation in this locale is inactive.
     */
    currentLocale?: string;
}

export declare type LinkType = "page" | "file" | "remote" | "email";

/**
 * Render a lucide icon by its stored PascalCase name. Renders nothing when the
 * name is empty or no longer exists in lucide. Forwards size/strokeWidth/etc.
 */
export declare function LucideIconByName({ name, size, strokeWidth, color, }: {
    name: string | null | undefined;
    size?: number;
    strokeWidth?: number;
    color?: string;
}): JSX.Element | null;

declare function MaskedSecret({ label, configured, hint, value, onChange, onClear, onUndoClear, disabled, width, rows, placeholder, labels, }: MaskedSecretProps): JSX.Element;

declare interface MaskedSecretProps {
    label: string;
    /** A secret is stored server-side (renders the "✓ Configured" chip). */
    configured: boolean;
    hint?: ReactNode;
    value: string;
    onChange: (v: string) => void;
    onClear?: () => void;
    /** Set while the stored secret is MARKED for removal — the trash turns into
     *  an undo, so Save is the only thing that actually clears it. */
    onUndoClear?: () => void;
    disabled?: boolean;
    width?: number;
    /** Textarea variant (a PEM bundle, a P8 key) — no reveal eye: a multi-line
     *  secret is typed in the clear and never read back. */
    rows?: number;
    placeholder?: string;
    /** Labels (the kit carries no translations). */
    labels: {
        configured: string;
        show: string;
        hide: string;
        clear: string;
        undo: string;
    };
}

export declare interface MediaFile {
    id: string;
    projectSlug: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    cdnUrl: string;
    storagePath: string;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
}

export declare function MediaPicker({ opened, onClose, onSelect, accept, title, }: MediaPickerProps): JSX.Element;

export declare interface MediaPickerProps {
    opened: boolean;
    onClose: () => void;
    onSelect: (file: MediaFile) => void;
    /** Restrict the picker to only show images or documents. Defaults to "all". */
    accept?: "image" | "document" | "all";
    title?: string;
}

declare function Menu({ open, minWidth, align, top, up, autoFlip, style, children }: MenuProps): JSX.Element | null;

declare function MenuItem({ icon: Icon, danger, selected, disabled, onClick, children, style }: MenuItemProps): JSX.Element;

declare interface MenuItemProps {
    icon?: LucideIcon;
    danger?: boolean;
    selected?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    children: ReactNode;
    style?: CSSProperties;
}

declare function MenuLabel({ children }: {
    children: ReactNode;
}): JSX.Element;

declare interface MenuProps {
    open?: boolean;
    minWidth?: number;
    align?: "left" | "right";
    top?: string;
    /** Force opening upward (bottom-anchored above the trigger). */
    up?: boolean;
    /** Flip up / swap side automatically when the panel would overflow. Default true. */
    autoFlip?: boolean;
    style?: CSSProperties;
    children: ReactNode;
}

declare function MenuSeparator(): JSX.Element;

declare function Modal({ open, onClose, width, height, maxHeight, resizable, expandLabel, collapseLabel, mobileSheet, children, style, }: ModalProps_2): ReactPortal | null;

declare function ModalBody({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare function ModalFooter({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare function ModalHeader({ title, subtitle, icon: Icon, closeLabel, onClose }: ModalHeaderProps): JSX.Element;

declare interface ModalHeaderProps {
    title: ReactNode;
    subtitle?: ReactNode;
    icon?: LucideIcon;
    /** Accessible label for the close button (pass t("common.close")). */
    closeLabel: string;
    onClose?: () => void;
}

declare interface ModalProps_2 {
    open?: boolean;
    onClose?: () => void;
    /** 480 forms / 580 pickers / 720+ editors (contract §2). */
    width?: number;
    /** Fixed card height (e.g. "84%") — editors; default content-fit. */
    height?: string;
    maxHeight?: string;
    /** Full-screen toggle in the header (prototype text/widget editors). */
    resizable?: boolean;
    /** Accessible labels for the resize toggle (pass translated strings). */
    expandLabel?: string;
    collapseLabel?: string;
    /** Present as a bottom sheet on mobile viewports. Default true. */
    mobileSheet?: boolean;
    children: ReactNode;
    style?: CSSProperties;
}

declare type NativeProps = InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>;

declare function NavItem({ icon: Icon, label, active, onClick, style, count }: NavItemProps): JSX.Element;

declare interface NavItemProps {
    icon: LucideIcon;
    label: ReactNode;
    active?: boolean;
    onClick?: () => void;
    style?: CSSProperties;
    /**
     * Kit round 21 (DECISIONS 216): a trailing unseen-count pill ("Sales · 3") for
     * the NEW-item badges. Hidden at 0 / null. Same teal-on-tint ink as the active
     * row so it never competes with the label.
     */
    count?: number | null;
}

/**
 * A project-defined top-level sidebar screen, injected via
 * createAdmin({ navSections }). The shared admin renders the nav-item chrome
 * (label + icon, role gating) and mounts the project's `component`, passing it
 * NavSectionHostApi so it can drive the built-in PageEditor. The component is
 * otherwise self-contained — same separation as settingsSections.
 */
export declare interface NavSectionDef {
    /** Stable section id. Used as the active-section key (must not collide with
     *  built-in sections: dashboard/pages/media/menus/settings/users/activity/strings). */
    key: string;
    /** Nav-item label. Use a { en, hr } map for multilingual admins. */
    label: string | Record<string, string>;
    /** lucide-react icon name (PascalCase), resolved via getLucideIcon. */
    icon?: string;
    /** Roles allowed to see this nav item. Default: all roles. */
    roles?: Role[];
    /** The screen UI. Mounted when its nav item is active; receives NavSectionProps. */
    component: ComponentType<NavSectionProps>;
}

/**
 * Navigation helpers injected into every nav-section component so a project
 * screen can launch the built-in PageEditor (App's `setView` is internal).
 */
export declare interface NavSectionHostApi {
    /** Open the built-in PageEditor for an existing page. */
    openPageEditor: (pageId: string) => void;
    /** Open the built-in PageEditor in create mode for a page type (+ optional parent). */
    createPage: (type: string, parentId?: string | null) => void;
}

/** Props every nav-section component receives when mounted. */
export declare type NavSectionProps = NavSectionHostApi;

export declare function NumberField({ label, value, onChange, placeholder, hint, required, disabled, suffix, }: Omit<BaseFieldProps, "value" | "onChange"> & {
    value: number | null;
    onChange: (value: number | null) => void;
    /** Unit shown inside the box as a LABEL (cm, %, €) — never typed. */
    suffix?: string;
}): JSX.Element;

declare interface OverlayChrome {
    mobile: boolean;
    resizable: boolean;
    full: boolean;
    toggleFull: () => void;
    expandLabel?: string;
    collapseLabel?: string;
}

export declare interface Page {
    id: string;
    title: string;
    slug: string;
    status: string;
    type: string;
    typeData: Record<string, unknown>;
    parentId: string | null;
    parentTitle?: string | null;
    sortOrder: number;
    publishAt?: string | null;
    draftSnapshot?: DraftSnapshot | null;
    deletedAt?: string | null;
    version?: number;
    createdAt: string;
    updatedAt: string;
    translations?: Record<string, PageTranslation>;
    hasChildren?: boolean;
}

/**
 * One project-defined card in the page editor, injected through a code-defined
 * page type. This is the DEFAULT way to give a bespoke page type its inputs:
 * fixed fields grouped into cards, outside the Mixed Content block editor.
 *
 * Use it instead of a custom block type whenever the page's shape is fixed —
 * `fields` only covers a flat list of primitives, while a section component can
 * render columns, repeaters, pickers, anything.
 */
export declare interface PageEditorSectionDef {
    /** Stable key. Also the section's slice of the page's typeData. */
    key: string;
    /** Section title. Use a { en, hr } map for multilingual admins; follows the UI language. */
    label: string | Record<string, string>;
    /**
     * One line under the section rule explaining what the editor is filling in
     * (where the content shows up, what the shop sees). Same { en, hr } shape as
     * `label`. Optional — omit it when the title says everything.
     */
    hint?: string | Record<string, string>;
    /** The section UI. Compose it from the exported editor-field primitives
     *  (`FieldSection` is already around it — start at `FieldRow` / `Field` /
     *  `TextField` / `ImageField` / `Repeater`), so the page keeps the design
     *  layer (DECISIONS 248). */
    component: ComponentType<PageEditorSectionProps>;
    /**
     * Declare which parts of this section's slice are prose, for AI translation
     * (DECISIONS 249). Paths are relative to the data object passed in. Without
     * it core guesses with `heuristicTranslatable`, which conservatively skips
     * anything that looks like an id, a URL or a code — so declare the hook when
     * a text field of yours is a short word the guesser would mistake for one.
     */
    translatable?: TranslatableHook;
}

/**
 * Props a project's page-editor section receives. `data` is that section's slice
 * of the page's `typeData` (empty object on a fresh page); `onChange` replaces
 * it. Everything else — the card chrome, dirty tracking, autosave, per-locale
 * storage — is the editor's job.
 */
export declare interface PageEditorSectionProps {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

export declare function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps): JSX.Element;

/**
 * Canonical page header — used at the top of every content area.
 *
 * Replaces the ad-hoc `<div className="cms-page-head">` blocks scattered
 * across SiteSettings, MediaLibrary, PageTree, UserManager, etc. Adds the
 * eyebrow (small UPPERCASE section label) that ties each screen back to
 * its sidebar group (Workspace / System).
 *
 * Usage:
 *
 *   <PageHeader
 *     eyebrow={t("nav.workspace")}
 *     title={t("settings.title")}
 *     subtitle={t("settings.subtitle")}
 *     actions={
 *       <>
 *         <Button variant="ghost"   onClick={onDiscard} disabled={!isDirty}>Discard</Button>
 *         <Button variant="primary" onClick={onSave}    loading={saving} disabled={!isDirty}>Save changes</Button>
 *       </>
 *     }
 *   />
 *
 * The component is intentionally tiny — its job is to enforce the visual
 * pattern, not to manage state. State lives in the parent.
 */
export declare interface PageHeaderProps {
    /** Small UPPERCASE label above the title (e.g. "Workspace", "System"). Optional. */
    eyebrow?: ReactNode;
    /** Required — the page title. Renders in the display font. */
    title: ReactNode;
    /** One-line description shown beneath the title, muted. */
    subtitle?: ReactNode;
    /** Optional action buttons rendered flush right (e.g. "New page", "Save changes"). */
    actions?: ReactNode;
}

export declare interface PageTranslation {
    active: boolean;
    title: string;
    slug: string;
    typeData: Record<string, unknown>;
    blocks: Array<{
        type: string;
        data: Record<string, unknown>;
    }>;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImageUrl: string | null;
    canonicalUrl: string | null;
    noindex: boolean;
}

export declare interface PageTypeDefinition {
    type: string;
    label: string | Record<string, string>;
    /** Max total pages of this type across the whole site. */
    limit?: number;
    /** Max children of this type under a single parent instance. */
    perParentLimit?: number;
    /** Whether this page can live at root level (no parent). Default: true. */
    canBeRoot?: boolean;
    /** Whether instances of this page type can be deleted from the admin. Default: true. */
    deletable?: boolean;
    /**
     * System page type — exists only to wire a frontend route to a page type and
     * holds no editable content beyond the title. Pages of this type are hidden
     * from the Pages tree and the New-Page picker for every role except
     * `developer`, and rendered with a distinct orange accent for developers.
     * Default: false.
     */
    system?: boolean;
    /**
     * Hide pages of this type from the Pages tree and the New-Page picker for ALL
     * roles, while keeping them fully editable (titles, blocks, SEO, publish) via a
     * project-injected screen (createAdmin({ navSections })). Use for content that
     * exists in large flat volumes — e.g. ~100 product items managed through a
     * dedicated Products screen rather than browsed in the tree. Distinct from
     * `system` (developer-only plumbing, still visible to developers): a
     * `hideFromTree` type is editor-managed but never shown in the tree at all.
     * Default: false.
     */
    hideFromTree?: boolean;
    /** Which page types can be this page's parent. Empty/undefined = root only. */
    allowedParentTypes?: string[];
    /** Which page types this page can contain as direct children. Empty/undefined = no children allowed. */
    allowedChildTypes?: string[];
    /** Structured fields stored as typeData on the page. */
    fields?: FieldDef[];
    /**
     * Project-defined editor cards, rendered after the title (and after `fields`)
     * and BEFORE the content-block editor. Each one owns a slice of `typeData`
     * keyed by its `key`. The normal choice for a bespoke page type — see
     * PageEditorSectionDef.
     */
    editorSections?: PageEditorSectionDef[];
    /** Whether to show the content block editor. Default: true. */
    allowBlocks?: boolean;
    /** Restrict which block types appear in the editor for this page type. Omit to allow all. */
    allowedBlockTypes?: string[];
    /**
     * Opt out of the singleton-block behaviour that `allowedBlockTypes.length === 1`
     * normally triggers. Set `true` to keep a single allowed block type (e.g. only
     * `mixed-content`) while still allowing the author to add an UNLIMITED number of
     * those blocks: the "+ Add new section" button and the per-block Remove icon stay
     * visible and no block is auto-seeded on create. Default: false (single allowed
     * block type ⇒ singleton page).
     */
    multiBlock?: boolean;
}

declare function Pagination({ page, total, onChange, summary, prevLabel, nextLabel, style }: PaginationProps): JSX.Element;

declare interface PaginationProps {
    page?: number;
    total?: number;
    onChange?: (page: number) => void;
    summary?: ReactNode;
    /** Accessible labels for the prev/next arrows (pass translated strings). */
    prevLabel: string;
    nextLabel: string;
    style?: CSSProperties;
}

/**
 * A flat list of rows that each pick ONE thing (a category, a collection, a
 * page). Nothing hides behind a collapsed row: the control itself shows the
 * choice, which is the whole point when a row has a single field.
 *
 * An EMPTY string is a real, kept row — a freshly added row has no choice yet,
 * and dropping it would make "Add" look dead. Readers filter the empties out.
 */
export declare function PickerRows({ values, onChange, renderPicker, addLabel, emptyLabel, hint, max, disabled, }: {
    values: string[];
    onChange: (next: string[]) => void;
    renderPicker: (value: string, set: (next: string | null) => void, index: number) => ReactNode;
    addLabel?: string;
    emptyLabel?: string;
    hint?: string;
    max?: number;
    disabled?: boolean;
}): JSX.Element;

declare function Popover({ open, onClose, align, placement, width, autoFlip, scrim, trigger, children, style }: PopoverProps): JSX.Element;

declare function PopoverBody({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare function PopoverHeader({ children, style }: {
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare interface PopoverProps {
    open?: boolean;
    onClose?: () => void;
    align?: "left" | "right";
    placement?: "top" | "bottom";
    width?: number;
    /** Flip/swap automatically on viewport overflow. Default true. */
    autoFlip?: boolean;
    /** Render the full-viewport click catcher that dismisses on an outside click.
     *  Kit round 16: set false for a HOVER/FOCUS-driven popover — the catcher sits
     *  over the trigger, so the trigger receives mouseleave the instant the panel
     *  opens and the pair flickers (and every click on the page is swallowed while
     *  hovering). Click-driven popovers keep the default. */
    scrim?: boolean;
    trigger: ReactNode;
    children: ReactNode;
    style?: CSSProperties;
}

/** One fixed input inside a section. `key` is stable and stored with the value. */
export declare interface ProductDetailFieldDef {
    /** Stable field identifier, stored alongside the value. */
    key: string;
    /** Input label. `{ en, hr }` for a multilingual admin; omit for an unlabelled
     *  single-field section (the section title already names it). */
    label?: string | Record<string, string>;
    /** Render a textarea instead of a one-line input. */
    multiline?: boolean;
    /** Optional placeholder — same `{ en, hr }` shape as `label`. */
    placeholder?: string | Record<string, string>;
    /**
     * Accept ONLY a number (digits and at most one `.` or `,` separator). The
     * editor rejects anything else as it is typed, so the stored value is always
     * bare — the unit belongs to `suffix`, not to what the shop types.
     */
    numeric?: boolean;
    /**
     * Display affixes STORED WITH THE VALUE and rendered around it by the
     * storefront, which therefore needs to know nothing about this schema: a
     * diameter's `⌀`, a length's `cm`. Plain strings, not `{ en, hr }` — a unit
     * symbol is not content, and a piece is 24 cm in every language. The editor
     * shows them beside the input so it is obvious they are not to be typed.
     *
     * The storefront joins the three parts with spaces (`⌀ 24 cm`), so write them
     * without padding.
     */
    prefix?: string;
    suffix?: string;
}

/** One fixed section — becomes one `detailTabs` entry. */
export declare interface ProductDetailSectionDef {
    /** Stable section id. Becomes the detail tab's `id`, so DON'T change it after
     *  products have been saved (a rename orphans the stored values). */
    id: string;
    /** Section heading, and the tab `title` the storefront receives. */
    title: string | Record<string, string>;
    /** The section's inputs, in display order. */
    fields: ProductDetailFieldDef[];
}

export declare interface ProjectSettings<T = Record<string, unknown>> {
    value: T;
    version: number;
}

declare interface Props {
    children: ReactNode;
}

/**
 * An ORDERED list of repeating items, each collapsed to a titled row that opens
 * into its own fields. The row idiom is the page editor's block card, so a
 * repeater inside a page-editor section reads as part of the same page.
 *
 * The item type is the project's own — this component only reorders, adds and
 * removes; `renderItem` owns everything inside.
 */
export declare function Repeater<T>({ items, onChange, renderItem, makeEmpty, titleOf, itemLabel, addLabel, emptyLabel, max, disabled, }: {
    items: T[];
    onChange: (next: T[]) => void;
    renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
    makeEmpty: () => T;
    /** Row title — falls back to "<itemLabel> N" while the item is unnamed. */
    titleOf?: (item: T, index: number) => string;
    itemLabel?: string;
    addLabel?: string;
    emptyLabel?: string;
    max?: number;
    disabled?: boolean;
}): JSX.Element;

declare function ResizeToggle({ chrome }: {
    chrome: OverlayChrome;
}): JSX.Element | null;

export declare function resolveLabel(label: string | Record<string, string>, locale: string): string;

export declare function resolvePageTitle(page: Pick<Page, "title" | "translations">, contentLocale: string, defaultLocale: string): {
    title: string;
    isFallback: boolean;
};

export declare function RichTextEditor({ value, onChange, placeholder, minHeight, editable, fillParent, }: RichTextEditorProps): JSX.Element | null;

export declare interface RichTextEditorProps {
    value: Record<string, unknown> | null;
    onChange: (json: Record<string, unknown>) => void;
    placeholder?: string;
    minHeight?: number;
    editable?: boolean;
    /**
     * When true, the editor fills its flex parent and the content area scrolls
     * internally. Use inside fixed-height containers like drawer bodies.
     */
    fillParent?: boolean;
}

declare type Role = "developer" | "owner" | "admin" | "content_admin" | "shop_admin" | "shop_manager" | "editor" | "viewer";

declare type RoleValue = "owner" | "developer" | "admin" | "editor" | "viewer";

export declare function saveProjectSettings<T = Record<string, unknown>>(key: string, value: T, version: number): Promise<ProjectSettings<T>>;

declare function Select({ label, hint, options, value, onChange, placeholder, style }: SelectProps): JSX.Element;

declare interface SelectOption {
    value: string;
    label: ReactNode;
    icon?: LucideIcon;
}

declare interface SelectProps {
    label?: ReactNode;
    hint?: ReactNode;
    options: SelectOption[];
    value?: string | null;
    onChange?: (value: string) => void;
    placeholder?: string;
    style?: CSSProperties;
}

export declare interface SettingsSaveState {
    /** Enables the header Save. */
    dirty: boolean;
    /** Disables it while the write is in flight. */
    saving?: boolean;
    onSave: () => void | Promise<void>;
    /** Optional button label; defaults to the core "Save settings". */
    label?: string;
}

export declare function SettingsSection({ title, hint, note, badge, action, children }: SettingsSectionProps): JSX.Element;

/**
 * A project-defined Settings tab, injected via createAdmin({ settingsSections }).
 * The shared admin only knows how to render the tab chrome (label + icon, role
 * gating) and mount the project's `component`; the component is fully
 * self-contained — it loads and saves its own data (typically via
 * fetchProjectSettings/saveProjectSettings). It publishes its Save affordance to
 * the Settings header with `useSettingsSave()` so the button sits in the same
 * place as on the built-in tabs (Sandro, 2026-07-29).
 */
export declare interface SettingsSectionDef {
    /** Stable tab id. Also the conventional project-settings store key. */
    key: string;
    /** Tab label. Use a { en, hr } map for multilingual admins. */
    label: string | Record<string, string>;
    /** lucide-react icon name (PascalCase), resolved via getLucideIcon. */
    icon?: string;
    /** Roles allowed to see this tab. Default: content managers
     *  (owner / admin / content_admin / developer). `"admin"` is the permanent
     *  legacy alias for `"owner"` (DECISIONS 136) — listing either grants both,
     *  so pre-split project configs keep working. */
    roles?: Role[];
    /** The section UI. Mounted when its tab is active. */
    component: ComponentType;
}

export declare interface SettingsSectionProps {
    title: ReactNode;
    hint?: ReactNode;
    /** Inline lower-case aside beside the title, e.g. "(this device)". */
    note?: ReactNode;
    /** Right-aligned slot — a tag badge, or an action button. */
    badge?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
}

declare function SlideViews({ index, children, fit, style }: SlideViewsProps): JSX.Element;

declare interface SlideViewsProps {
    index: number;
    children: ReactNode;
    /** Override the shell-provided sizing mode. */
    fit?: boolean;
    style?: CSSProperties;
}

declare function StatCard({ label, value, delta, deltaTone, bars, style }: StatCardProps): JSX.Element;

declare interface StatCardBar {
    h: number;
    active?: boolean;
}

declare interface StatCardProps {
    label: ReactNode;
    value: ReactNode;
    delta?: ReactNode;
    deltaTone?: "teal" | "warn" | "mute";
    bars?: (number | StatCardBar)[];
    style?: CSSProperties;
}

declare interface State {
    error: Error | null;
}

export declare type Status = "published" | "draft" | "scheduled" | "updated" | "pending" | "review" | "deleted" | "failed" | "unsaved";

export declare function StatusBadge({ status, children, ...rest }: StatusBadgeProps): JSX.Element;

declare function StatusBadge_2({ kind, value, outline, dot, icon: Icon, ring, sub, tile, focusable, children, style }: StatusBadgeProps_2): JSX.Element;

export declare interface StatusBadgeProps extends Omit<BadgeProps, "color" | "variant"> {
    status: Status;
    children?: ReactNode;
}

declare interface StatusBadgeProps_2 {
    kind?: "status" | "role" | "tag" | "tone";
    value: string;
    /** tone only — transparent fill + 1px border in the tone colour (`obadge`). */
    outline?: boolean;
    /** tone only — 7px coloured dot + plain label, no pill (`dotCell`). */
    dot?: boolean;
    /** tone only — 11px leading lucide icon. */
    icon?: LucideIcon;
    /**
     * tone + dot only (kit round 22) — the table status cell of the redesigned
     * commerce lists: an 8px dot in the tone's DOT colour with a soft 3px ring,
     * label at 12.5px that INHERITS weight + colour from the cell (a row can read
     * bold while unseen without the badge knowing why).
     */
    ring?: boolean;
    /** tone + dot only (kit round 22) — a quieter second line under the label ("bank transfer", "expires 25 Sep"). */
    sub?: ReactNode;
    /**
     * tone only (kit round 22) — an icon-only 20px marker tile (requires `icon`);
     * `children` become its accessible name. Focusable so a wrapping kit Tooltip
     * opens from the keyboard too.
     */
    tile?: boolean;
    /** tile only — false inside an already-interactive row (a phone list row is one button). Default true. */
    focusable?: boolean;
    children: ReactNode;
    style?: CSSProperties;
}

declare type StatusValue = "published" | "active" | "draft" | "pending" | "disabled" | "error";

/** One stored field: the schema `key`, its label at save time, and the value.
 *  `prefix`/`suffix` are frozen with it the same way the label is, so a consumer
 *  can render `⌀ 24 cm` from a bare `24` without reading the schema. */
export declare interface StoredDetailField {
    key: string;
    label: string;
    value: string;
    prefix?: string;
    suffix?: string;
}

declare interface TabItem {
    value: string;
    label?: ReactNode;
    icon?: LucideIcon;
    count?: number | string | null;
    title?: string;
    separator?: boolean;
    /** Rail only (kit round 20): a non-interactive group label row, styled like
     *  the sidebar's nav-group caps. `label` is the heading text. */
    heading?: boolean;
}

declare function Table<Row extends Record<string, unknown>>({ columns, rows, sort, onSort, selectable, selectedKeys, onToggle, onToggleAll, rowKey, onRowClick, rowProps, dense, style, }: TableProps<Row>): JSX.Element;

declare interface TableColumn<Row> {
    key: string;
    label: ReactNode;
    align?: "left" | "center" | "right";
    width?: number | string;
    sortable?: boolean;
    render?: (row: Row) => ReactNode;
}

declare interface TableProps<Row extends Record<string, unknown>> {
    columns: TableColumn<Row>[];
    rows: Row[];
    sort?: {
        key: string;
        dir: "asc" | "desc";
    } | null;
    onSort?: (key: string) => void;
    selectable?: boolean;
    selectedKeys?: unknown[];
    onToggle?: (key: unknown) => void;
    onToggleAll?: (checked: boolean) => void;
    rowKey?: string;
    onRowClick?: (row: Row) => void;
    /** Extra attributes merged onto each <tr> (drag handlers, data-* hooks). */
    rowProps?: (row: Row, index: number) => HTMLAttributes<HTMLTableRowElement> & Record<string, unknown>;
    /** 10px cell sides (default 14px) — a wide list that must fit the well. */
    dense?: boolean;
    style?: CSSProperties;
}

declare function Tabs({ items, value, onChange, variant, fullWidth, style }: TabsProps): JSX.Element;

declare interface TabsProps {
    items: TabItem[];
    value?: string;
    onChange?: (value: string) => void;
    variant?: "segmented" | "pills" | "rail" | "underline";
    fullWidth?: boolean;
    style?: CSSProperties;
}

declare type TagValue = "draft" | "auto" | "manual" | "developer" | "configured" | "neutral";

export declare function TextAreaField({ rows, ...props }: BaseFieldProps & {
    rows?: number;
}): JSX.Element;

export declare function TextField({ label, value, onChange, placeholder, hint, required, disabled }: BaseFieldProps): JSX.Element;

declare function Toast({ tone, title, children, onClose, closeLabel, action, style }: ToastProps): JSX.Element;

declare interface ToastProps {
    tone?: ToastTone;
    title?: ReactNode;
    children?: ReactNode;
    onClose?: () => void;
    /** Accessible label for the dismiss button (pass t("common.dismiss")). */
    closeLabel?: string;
    action?: ReactNode;
    style?: CSSProperties;
}

declare type ToastTone = "success" | "error" | "warn" | "info";

declare function ToastViewport({ position, children, style }: {
    position?: "bottom-right" | "bottom-left" | "top-right" | "top-center";
    children: ReactNode;
    style?: CSSProperties;
}): JSX.Element;

declare function Toggle({ checked, onChange, size, label, hint, disabled, style }: ToggleProps): JSX.Element;

declare interface ToggleProps {
    checked?: boolean;
    onChange?: (checked: boolean) => void;
    size?: "md" | "sm";
    label?: ReactNode;
    hint?: ReactNode;
    disabled?: boolean;
    style?: CSSProperties;
}

declare type ToneValue = "teal" | "green" | "yellow" | "blue" | "orange" | "red" | "grape" | "gray";

declare function Tooltip({ label, placement, open, follow, children, style }: TooltipProps): JSX.Element;

declare interface TooltipProps {
    label: ReactNode;
    placement?: "top" | "bottom" | "left" | "right";
    /** Force visibility (styleguide specimens). */
    open?: boolean;
    /**
     * Anchor the tip to the POINTER rather than the trigger's box (kit round 15).
     * For triggers that are tall or wide — a full-height chart column — a tip
     * pinned to the box edge lands far from what the user is pointing at.
     * Placement still applies (the tip sits above the cursor by default) and the
     * same viewport clamping runs.
     */
    follow?: boolean;
    children: ReactNode;
    style?: CSSProperties;
}

/** A breadcrumb the review step shows above a segment ("Section 2 · Accordion · item 3"). */
export declare type TranslatableCrumb = {
    kind: "title";
} | {
    kind: "seo";
    field: "metaTitle" | "metaDescription";
} | {
    kind: "field";
    name: string;
    label?: string;
} | {
    kind: "section";
    key: string;
    label?: string;
} | {
    kind: "block";
    index: number;
    type: string;
    label?: string;
} | {
    kind: "widget";
    type: string;
    label?: string;
} | {
    kind: "item";
    index: number;
};

/**
 * Declare exactly which parts of a block's or an editor section's data are
 * prose. Paths are RELATIVE to the data object passed in. Without it, core
 * falls back to `heuristicTranslatable`, which skips anything that looks like
 * an identifier, a URL or a code — including a legitimate short text field.
 *
 *   translatable: (d) => [
 *     ...heuristicTranslatable(d),
 *     ...(d.items as PressItem[]).map((_, i) => ({ path: ["items", i, "type"], kind: "plain" as const })),
 *   ]
 */
export declare type TranslatableHook = (data: Record<string, unknown>) => TranslatableRef[];

/** "plain" = a string; "richtext" = a TipTap/ProseMirror document. */
export declare type TranslatableKind = "plain" | "richtext";

/** Where a value lives inside a locale slice, e.g. ["blocks", 0, "data", "title"]. */
export declare type TranslatablePath = (string | number)[];

/** One translatable value: where it is, what it is, and how to name it. */
export declare interface TranslatableRef {
    path: TranslatablePath;
    kind: TranslatableKind;
    crumbs?: TranslatableCrumb[];
}

export declare namespace ui {
    export {
        Button_2 as Button,
        ButtonProps_3 as ButtonProps,
        ButtonVariant_2 as ButtonVariant,
        ButtonSize,
        IconButton_2 as IconButton,
        IconButtonProps_2 as IconButtonProps,
        IconButtonVariant_2 as IconButtonVariant,
        Card,
        CardProps,
        CardVariant,
        Input,
        InputProps,
        MaskedSecret,
        MaskedSecretProps,
        Select,
        SelectProps,
        SelectOption,
        Checkbox,
        CheckboxProps,
        Chip,
        ChipProps,
        Toggle,
        ToggleProps,
        Tabs,
        TabsProps,
        TabItem,
        NavItem,
        NavItemProps,
        Breadcrumb,
        BreadcrumbProps,
        BreadcrumbItem,
        Pagination,
        PaginationProps,
        StatusBadge_2 as StatusBadge,
        StatusBadgeProps_2 as StatusBadgeProps,
        StatusValue,
        RoleValue,
        TagValue,
        ToneValue,
        StatCard,
        StatCardProps,
        StatCardBar,
        BarChart,
        BarChartProps,
        BarChartBucket,
        Table,
        TableProps,
        TableColumn,
        LangSwitch,
        LangRows,
        LangSwitchOption,
        LangRowOption,
        Banner,
        BannerProps,
        BannerTone,
        Toast,
        ToastViewport,
        ToastProps,
        ToastTone,
        EmptyState_2 as EmptyState,
        EmptyStateProps_2 as EmptyStateProps,
        Modal,
        ModalHeader,
        ModalBody,
        ModalFooter,
        ResizeToggle,
        useOverlayChrome,
        ModalProps_2 as ModalProps,
        ModalHeaderProps,
        Drawer,
        DrawerHeader,
        DrawerBody,
        DrawerFooter,
        DrawerProps_2 as DrawerProps,
        DrawerHeaderProps,
        Menu,
        MenuItem,
        MenuSeparator,
        MenuLabel,
        MenuProps,
        MenuItemProps,
        Popover,
        PopoverHeader,
        PopoverBody,
        PopoverProps,
        Tooltip,
        TooltipProps,
        SlideViews,
        SlideViewsProps
    }
}

export declare function useContentLocale(): ContentLocaleContextValue;

/** Overlay chrome (mobile? resizable? full-screen toggle) of the nearest Modal.
 *  Lets a shell that supplies its OWN header — e.g. MediaPickerPane — still
 *  render the full-screen toggle, which otherwise only ships inside
 *  ModalHeader (that gap made `resizable` silently inert on the media picker). */
declare function useOverlayChrome(): OverlayChrome;

/**
 * Publish a project settings section's Save button to the Settings header.
 * Call it on every render with the current state; the handler is read through a
 * ref so an inline arrow function never re-publishes.
 */
export declare function useSettingsSave({ dirty, saving, onSave, label }: SettingsSaveState): void;

export { }

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        indent: {
            indent: () => ReturnType;
            outdent: () => ReturnType;
        };
    }
}
