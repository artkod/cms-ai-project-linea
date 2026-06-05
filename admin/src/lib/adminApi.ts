// ─── Authenticated admin API helper (project-local) ─────────────────────────
//
// The Products screen needs a few authenticated admin endpoints that admin-base
// doesn't re-export to projects (page list / delete). We hit them directly with
// the same conventions admin-base's internal client uses: cookie auth
// (`credentials: "include"`) + the `X-Project-Slug` header. Base URL comes from
// the same env var main.tsx passes to createAdmin.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";
const PROJECT_SLUG = "project-linea";

function headers(extra?: Record<string, string>): Record<string, string> {
  return { "X-Project-Slug": PROJECT_SLUG, ...extra };
}

export interface AdminTranslation {
  active: boolean;
  title: string;
  slug: string;
  typeData?: Record<string, unknown>;
  blocks?: Array<{ type: string; data: Record<string, unknown> }>;
}

export interface AdminPage {
  id: string;
  type: string;
  status: "draft" | "published";
  parentId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  // Flat fields mirror the default locale; `translations` carries every locale.
  title: string;
  slug: string;
  blocks?: Array<{ type: string; data: Record<string, unknown> }>;
  translations?: Record<string, AdminTranslation>;
}

/**
 * Fetch EVERY page of a type (drafts + published), paging past the API's 100-row
 * cap. `locale` only affects which locale's title is used for free-text search /
 * parentTitle server-side — every locale is still returned in `translations`.
 */
export async function listAllPagesByType(type: string, locale?: string): Promise<AdminPage[]> {
  const PAGE = 100;
  const out: AdminPage[] = [];
  let offset = 0;
  for (;;) {
    const qs = new URLSearchParams({ type, limit: String(PAGE), offset: String(offset) });
    if (locale) qs.set("locale", locale);
    const res = await fetch(`${API_URL}/api/pages?${qs}`, {
      credentials: "include",
      headers: headers(),
    });
    if (!res.ok) throw new Error("Failed to fetch pages");
    const body = await res.json();
    const data: AdminPage[] = body.data ?? [];
    out.push(...data);
    offset += PAGE;
    const total = typeof body.total === "number" ? body.total : data.length;
    if (data.length === 0 || offset >= total) break;
  }
  return out;
}

/** The id of a singleton page type (e.g. "all-products"), or null if none exists. */
export async function getSingletonPageId(type: string): Promise<string | null> {
  const pages = await listAllPagesByType(type);
  return pages[0]?.id ?? null;
}

/** Soft-delete (trash) a page. Cascades server-side. */
export async function deletePageById(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/pages/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: headers(),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* ignore */
    }
    throw new Error(`Failed to delete page (${res.status}) ${detail}`);
  }
}
