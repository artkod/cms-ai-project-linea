import { ActionIconProps } from '@mantine/core';
import { BadgeProps } from '@mantine/core';
import { ButtonProps as ButtonProps_2 } from '@mantine/core';
import { Component } from 'react';
import { ComponentType } from 'react';
import { DrawerProps } from '@mantine/core';
import { ErrorInfo } from 'react';
import { ForwardRefExoticComponent } from 'react';
import { JSX } from 'react/jsx-runtime';
import { JSXElementConstructor } from 'react';
import { LucideIcon } from 'lucide-react';
import { ModalProps } from '@mantine/core';
import { ReactElement } from 'react';
import { ReactNode } from 'react';
import { ReactPortal } from 'react';
import { RefAttributes } from 'react';

export declare interface AdminConfig {
    apiUrl?: string;
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
     * `commerce:price-lists`, `commerce:discounts`. Empty/omitted = show all.
     */
    hiddenCommerceNav?: string[];
    /**
     * ProductEditor field keys to HIDE from this project's product editor (and
     * force to their canonical value on save, so the attribute can never drift).
     * Per-project product-model lockdown — UI-only otherwise. Keys: `type`
     * (physical/digital/service → forced physical), `sale` (buy/inquiry → forced
     * inquiry-only), `taxClass` (→ forced shop default), `kpdCode` (→ forced
     * empty). Empty/omitted = show all fields.
     */
    hiddenProductFields?: string[];
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
}

export declare const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;

export declare interface ButtonProps extends Omit<ButtonProps_2, "variant" | "color"> {
    /** Intent of the button — see file header for guidance. Defaults to `secondary`. */
    variant?: ButtonVariant;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    type?: "button" | "submit" | "reset";
}

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

export declare function EmptyState({ icon: Icon, title, description, actions, compact, }: EmptyStateProps): JSX.Element;

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

export declare class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: Error): State;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    render(): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | JSX.Element | null | undefined;
}

export declare function fetchProjectSettings<T = Record<string, unknown>>(key: string): Promise<ProjectSettings<T>>;

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

export declare const IconButton: ForwardRefExoticComponent<IconButtonProps & RefAttributes<HTMLButtonElement>>;

export declare interface IconButtonProps extends Omit<ActionIconProps, "variant" | "color" | "aria-label"> {
    variant?: IconButtonVariant;
    /** Required — used as both aria-label and tooltip text. */
    label: string;
    /** Set false to skip the tooltip wrapper. Defaults to true. */
    withTooltip?: boolean;
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
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

export declare function IconPicker({ value, onChange, label, required, modalTitle }: IconPickerProps): JSX.Element;

export declare function IconPickerModal({ opened, onClose, value, onConfirm, title, zIndex, }: IconPickerModalProps): JSX.Element;

export declare interface IconPickerModalProps {
    opened: boolean;
    onClose: () => void;
    /** Currently selected icon name (PascalCase), if any. */
    value?: string | null;
    /** Called with the chosen icon name. */
    onConfirm: (name: string) => void;
    /** Drawer title. Defaults to "Select an icon". */
    title?: string;
    /** Override z-index when stacking above another custom overlay. */
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

export declare function ImagePickerModal({ opened, onClose, title, mode, fileType, initialImages, onConfirm, zIndex, }: ImagePickerModalProps): JSX.Element;

export declare interface ImagePickerModalProps {
    opened: boolean;
    onClose: () => void;
    /** Modal title */
    title?: string;
    /**
     * "single" — clicking an image immediately confirms and closes.
     * "multi"  — rubber-band + checkmarks + explicit Confirm button.
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
    /** Override z-index when stacking above another custom overlay. */
    zIndex?: number;
}

export declare function isLinkDataValid(d: LinkData): boolean;

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

export declare function LinkPickerModal({ opened, onClose, mode, initialData, onConfirm, zIndex, currentLocale, showTextFields, }: LinkPickerModalProps): JSX.Element;

declare interface LinkPickerModalProps {
    opened: boolean;
    onClose: () => void;
    /** "widget" = full modal with button options; "rte" = link fields only */
    mode: "widget" | "rte";
    initialData?: Partial<LinkData>;
    onConfirm: (data: LinkData) => void;
    /** Override z-index when stacking above another custom overlay. */
    zIndex?: number;
    /**
     * Show the "Link text" + "Tooltip text" fields even in "rte" mode. Widget
     * mode always shows them (and the button-styling options); rte callers opt
     * in per-field. RichTextEditor's inline-link modal leaves this off so the
     * link text keeps coming from the selected text.
     */
    showTextFields?: boolean;
    /**
     * Locale the link is being authored in. When set, the "page" picker hides
     * pages whose translation in this locale is inactive — preventing link
     * targets that won't resolve in this language. Passed down from PageEditor
     * via Mixed Content blocks; omitted in single-locale projects.
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

export declare interface ProjectSettings<T = Record<string, unknown>> {
    value: T;
    version: number;
}

declare interface Props {
    children: ReactNode;
}

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

export declare function saveProjectSettings<T = Record<string, unknown>>(key: string, value: T, version: number): Promise<ProjectSettings<T>>;

/**
 * A project-defined Settings tab, injected via createAdmin({ settingsSections }).
 * The shared admin only knows how to render the tab chrome (label + icon, role
 * gating) and mount the project's `component`; the component is fully
 * self-contained — it loads/saves its own data (typically via
 * fetchProjectSettings/saveProjectSettings) and renders its own Save button.
 */
export declare interface SettingsSectionDef {
    /** Stable tab id. Also the conventional project-settings store key. */
    key: string;
    /** Tab label. Use a { en, hr } map for multilingual admins. */
    label: string | Record<string, string>;
    /** lucide-react icon name (PascalCase), resolved via getLucideIcon. */
    icon?: string;
    /** Roles allowed to see this tab. Default: content managers
     *  (owner / admin / content_admin / developer). */
    roles?: Role[];
    /** The section UI. Mounted when its tab is active. */
    component: ComponentType;
}

declare interface State {
    error: Error | null;
}

export declare type Status = "published" | "draft" | "scheduled" | "updated" | "pending" | "review" | "deleted" | "failed" | "unsaved";

export declare function StatusBadge({ status, children, ...rest }: StatusBadgeProps): JSX.Element;

export declare interface StatusBadgeProps extends Omit<BadgeProps, "color" | "variant"> {
    status: Status;
    children?: ReactNode;
}

export declare function useContentLocale(): ContentLocaleContextValue;

export { }

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        indent: {
            indent: () => ReturnType;
            outdent: () => ReturnType;
        };
    }
}
