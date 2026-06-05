import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  Accordion,
  Badge,
  Box,
  Group,
  Image,
  Loader,
  Modal,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Button,
  fetchProjectSettings,
  saveProjectSettings,
  ConflictError,
  useContentLocale,
  type NavSectionProps,
  type NavSectionDef,
} from "@cms/admin-base";
import {
  FolderTree,
  Boxes,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  PRODUCT_CATEGORIES_KEY,
  EMPTY_CATEGORIES,
  normalizeCategories,
  resolveCatLabel,
  slugify,
  uid,
  findMain,
  findSub,
  type ProductCategoriesValue,
  type MainCategory,
  type Subcategory,
} from "./categoryModel";
import {
  listAllPagesByType,
  getSingletonPageId,
  deletePageById,
  type AdminPage,
} from "../lib/adminApi";

// ─── i18n (project-local, keyed off the admin UI locale like the Settings sections) ───

function uiLang(): "en" | "hr" {
  return (localStorage.getItem("cms-ui-locale") as "en" | "hr" | null) ?? "en";
}

const STR = {
  en: {
    title: "Products",
    tabProducts: "Products",
    tabCategories: "Categories",
    addProduct: "New product",
    search: "Search products…",
    filterMain: "Main category",
    filterSub: "Subcategory",
    allCategories: "All categories",
    allSubcategories: "All subcategories",
    colImage: "",
    colName: "Name",
    colMain: "Main category",
    colSub: "Subcategory",
    colStatus: "Status",
    colActions: "",
    statusPublished: "Published",
    statusDraft: "Draft",
    edit: "Edit",
    delete: "Delete",
    none: "—",
    emptyProducts: "No products yet.",
    emptyFiltered: "No products match your filters.",
    perPage: "Per page",
    deleteTitle: "Delete product",
    deleteBody: (n: string) => `Delete “${n}”? It will be moved to Trash.`,
    cancel: "Cancel",
    deleted: "Product deleted",
    deleteFailed: "Couldn't delete the product",
    loadFailed: "Couldn't load products",
    noAllProducts:
      "The “All products” catalogue page doesn't exist yet. A developer must create it before products can be added.",
    // categories editor
    catsIntro:
      "Manage the main categories and subcategories used to classify products. Each product picks one main category and one subcategory.",
    addMain: "Add main category",
    addSub: "Add subcategory",
    mainLabel: (loc: string) => `Main category name (${loc.toUpperCase()})`,
    subLabel: (loc: string) => `Subcategory name (${loc.toUpperCase()})`,
    slug: "Slug",
    slugHelp: "Used in URLs / filter links. Auto-filled from the name; edit if needed.",
    removeMain: "Remove main category",
    removeSub: "Remove subcategory",
    noSubs: "No subcategories yet.",
    save: "Save categories",
    saved: "Categories saved",
    conflict: "Someone else saved categories while you were editing. Reload to get the latest version.",
    saveFailed: "Couldn't save categories",
    catsEmpty: "No categories yet. Add your first main category.",
    untitledCat: "(unnamed category)",
    subCount: (n: number) => `${n} ${n === 1 ? "subcategory" : "subcategories"}`,
  },
  hr: {
    title: "Proizvodi",
    tabProducts: "Proizvodi",
    tabCategories: "Kategorije",
    addProduct: "Novi proizvod",
    search: "Pretraži proizvode…",
    filterMain: "Glavna kategorija",
    filterSub: "Potkategorija",
    allCategories: "Sve kategorije",
    allSubcategories: "Sve potkategorije",
    colImage: "",
    colName: "Naziv",
    colMain: "Glavna kategorija",
    colSub: "Potkategorija",
    colStatus: "Status",
    colActions: "",
    statusPublished: "Objavljeno",
    statusDraft: "Skica",
    edit: "Uredi",
    delete: "Obriši",
    none: "—",
    emptyProducts: "Još nema proizvoda.",
    emptyFiltered: "Nijedan proizvod ne odgovara filterima.",
    perPage: "Po stranici",
    deleteTitle: "Obriši proizvod",
    deleteBody: (n: string) => `Obrisati „${n}”? Premjestit će se u smeće.`,
    cancel: "Odustani",
    deleted: "Proizvod obrisan",
    deleteFailed: "Brisanje proizvoda nije uspjelo",
    loadFailed: "Učitavanje proizvoda nije uspjelo",
    noAllProducts:
      "Stranica kataloga „Svi proizvodi” još ne postoji. Razvojni programer je mora izraditi prije dodavanja proizvoda.",
    catsIntro:
      "Uredite glavne kategorije i potkategorije za razvrstavanje proizvoda. Svaki proizvod odabire jednu glavnu kategoriju i jednu potkategoriju.",
    addMain: "Dodaj glavnu kategoriju",
    addSub: "Dodaj potkategoriju",
    mainLabel: (loc: string) => `Naziv glavne kategorije (${loc.toUpperCase()})`,
    subLabel: (loc: string) => `Naziv potkategorije (${loc.toUpperCase()})`,
    slug: "Slug",
    slugHelp: "Koristi se u URL-ovima / linkovima filtera. Auto-popunjeno iz naziva; uredite po potrebi.",
    removeMain: "Ukloni glavnu kategoriju",
    removeSub: "Ukloni potkategoriju",
    noSubs: "Još nema potkategorija.",
    save: "Spremi kategorije",
    saved: "Kategorije spremljene",
    conflict: "Netko je spremio kategorije dok ste uređivali. Osvježite stranicu za najnoviju verziju.",
    saveFailed: "Spremanje kategorija nije uspjelo",
    catsEmpty: "Još nema kategorija. Dodajte prvu glavnu kategoriju.",
    untitledCat: "(kategorija bez naziva)",
    subCount: (n: number) => `${n} ${n === 1 ? "potkategorija" : "potkategorije"}`,
  },
} as const;

// ─── Product item block data (only the bits the table reads) ─────────────────

interface ProductItemBlockData {
  mainPhoto?: { cdnUrl?: string } | null;
  mainCategoryId?: string | null;
  subcategoryId?: string | null;
}

function readProductCategory(page: AdminPage, defaultLocale: string): ProductItemBlockData {
  // Category is canonical on the default-locale block (mirrored into the flat
  // `blocks`). Fall back across locales so a product authored only in another
  // locale still shows its category.
  const blocksDefault = page.translations?.[defaultLocale]?.blocks ?? page.blocks ?? [];
  let block = blocksDefault.find((b) => b.type === "product-item");
  if (!block || (!(block.data as ProductItemBlockData).mainCategoryId && page.translations)) {
    for (const t of Object.values(page.translations ?? {})) {
      const b = t.blocks?.find((x) => x.type === "product-item");
      if (b && (b.data as ProductItemBlockData).mainCategoryId) {
        block = b;
        break;
      }
    }
  }
  return (block?.data ?? {}) as ProductItemBlockData;
}

// ─── Categories editor ───────────────────────────────────────────────────────

function CategoriesEditor({
  availableLocales,
  defaultLocale,
}: {
  availableLocales: string[];
  defaultLocale: string;
}) {
  const s = STR[uiLang()];
  const [value, setValue] = useState<ProductCategoriesValue>(EMPTY_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedSnapshot = useRef("");
  const versionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchProjectSettings<ProductCategoriesValue>(PRODUCT_CATEGORIES_KEY)
      .then(({ value: v, version }) => {
        if (cancelled) return;
        const norm = normalizeCategories(v);
        setValue(norm);
        savedSnapshot.current = JSON.stringify(norm);
        versionRef.current = version;
      })
      .catch(() => {
        /* defaults; first save inserts the row */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = useMemo(() => JSON.stringify(value) !== savedSnapshot.current, [value]);

  // ── mutations ──
  function patchMain(id: string, patch: Partial<MainCategory>) {
    setValue((v) => ({
      categories: v.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }
  function setMainLabel(id: string, loc: string, text: string) {
    setValue((v) => ({
      categories: v.categories.map((c) => {
        if (c.id !== id) return c;
        const label = { ...c.label, [loc]: text };
        // Keep slug in sync with the default-locale name until the user edits it.
        const slugStillAuto = c.slug === slugify(c.label[defaultLocale] ?? "");
        const slug = loc === defaultLocale && slugStillAuto ? slugify(text) : c.slug;
        return { ...c, label, slug };
      }),
    }));
  }
  function addMain() {
    setValue((v) => ({
      categories: [...v.categories, { id: uid(), slug: "", label: {}, subcategories: [] }],
    }));
  }
  function removeMain(id: string) {
    setValue((v) => ({ categories: v.categories.filter((c) => c.id !== id) }));
  }
  function addSub(mainId: string) {
    setValue((v) => ({
      categories: v.categories.map((c) =>
        c.id === mainId
          ? { ...c, subcategories: [...c.subcategories, { id: uid(), slug: "", label: {} }] }
          : c,
      ),
    }));
  }
  function setSubLabel(mainId: string, subId: string, loc: string, text: string) {
    setValue((v) => ({
      categories: v.categories.map((c) => {
        if (c.id !== mainId) return c;
        return {
          ...c,
          subcategories: c.subcategories.map((sub) => {
            if (sub.id !== subId) return sub;
            const label = { ...sub.label, [loc]: text };
            const slugStillAuto = sub.slug === slugify(sub.label[defaultLocale] ?? "");
            const slug = loc === defaultLocale && slugStillAuto ? slugify(text) : sub.slug;
            return { ...sub, label, slug };
          }),
        };
      }),
    }));
  }
  function patchSub(mainId: string, subId: string, patch: Partial<Subcategory>) {
    setValue((v) => ({
      categories: v.categories.map((c) =>
        c.id === mainId
          ? { ...c, subcategories: c.subcategories.map((sub) => (sub.id === subId ? { ...sub, ...patch } : sub)) }
          : c,
      ),
    }));
  }
  function removeSub(mainId: string, subId: string) {
    setValue((v) => ({
      categories: v.categories.map((c) =>
        c.id === mainId ? { ...c, subcategories: c.subcategories.filter((sub) => sub.id !== subId) } : c,
      ),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { version } = await saveProjectSettings(PRODUCT_CATEGORIES_KEY, value, versionRef.current);
      versionRef.current = version;
      savedSnapshot.current = JSON.stringify(value);
      setValue((prev) => ({ ...prev }));
      notifications.show({ message: s.saved, color: "teal" });
    } catch (err) {
      if (err instanceof ConflictError) {
        notifications.show({ message: s.conflict, color: "red", autoClose: false });
      } else {
        notifications.show({ message: s.saveFailed, color: "red" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">{s.catsIntro}</Text>

      {value.categories.length === 0 ? (
        <Text size="sm" c="dimmed">{s.catsEmpty}</Text>
      ) : (
        <Accordion variant="separated" multiple>
          {value.categories.map((cat) => (
            <Accordion.Item key={cat.id} value={cat.id}>
              <Accordion.Control>
                <Group justify="space-between" pr="md">
                  <Text fw={600}>
                    {resolveCatLabel(cat.label, uiLang(), defaultLocale) || s.untitledCat}
                  </Text>
                  <Text size="xs" c="dimmed">{s.subCount(cat.subcategories.length)}</Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={14}>
                  <Group gap={10} grow align="flex-start">
                    {availableLocales.map((loc) => (
                      <TextInput
                        key={loc}
                        label={s.mainLabel(loc)}
                        value={cat.label[loc] ?? ""}
                        onChange={(e) => setMainLabel(cat.id, loc, e.currentTarget.value)}
                      />
                    ))}
                  </Group>
                  <Group gap={10} align="flex-end">
                    <TextInput
                      label={s.slug}
                      description={s.slugHelp}
                      value={cat.slug}
                      onChange={(e) => patchMain(cat.id, { slug: slugify(e.currentTarget.value) })}
                      style={{ flex: 1 }}
                    />
                    <Button variant="danger" size="sm" leftSection={<Trash2 size={14} />} onClick={() => removeMain(cat.id)}>
                      {s.removeMain}
                    </Button>
                  </Group>

                  {/* Subcategories */}
                  <Box pl={12} style={{ borderLeft: "2px solid var(--mantine-color-gray-3, #dee2e6)" }}>
                    <Stack gap={12}>
                      {cat.subcategories.length === 0 ? (
                        <Text size="xs" c="dimmed">{s.noSubs}</Text>
                      ) : (
                        cat.subcategories.map((sub) => (
                          <Box
                            key={sub.id}
                            p={10}
                            style={{ border: "1px solid var(--mantine-color-gray-3, #dee2e6)", borderRadius: 8 }}
                          >
                            <Stack gap={8}>
                              <Group gap={10} grow align="flex-start">
                                {availableLocales.map((loc) => (
                                  <TextInput
                                    key={loc}
                                    label={s.subLabel(loc)}
                                    value={sub.label[loc] ?? ""}
                                    onChange={(e) => setSubLabel(cat.id, sub.id, loc, e.currentTarget.value)}
                                  />
                                ))}
                              </Group>
                              <Group gap={10} align="flex-end">
                                <TextInput
                                  label={s.slug}
                                  value={sub.slug}
                                  onChange={(e) => patchSub(cat.id, sub.id, { slug: slugify(e.currentTarget.value) })}
                                  style={{ flex: 1 }}
                                />
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  size="lg"
                                  aria-label={s.removeSub}
                                  onClick={() => removeSub(cat.id, sub.id)}
                                >
                                  <Trash2 size={16} />
                                </ActionIcon>
                              </Group>
                            </Stack>
                          </Box>
                        ))
                      )}
                      <Group>
                        <Button variant="secondary" size="sm" leftSection={<Plus size={14} />} onClick={() => addSub(cat.id)}>
                          {s.addSub}
                        </Button>
                      </Group>
                    </Stack>
                  </Box>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      <Group justify="space-between">
        <Button variant="secondary" leftSection={<Plus size={16} />} onClick={addMain}>
          {s.addMain}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!isDirty}>
          {s.save}
        </Button>
      </Group>
    </Stack>
  );
}

// ─── Products table ──────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = ["12", "24", "48"];

function ProductsTable({
  openPageEditor,
  createPage,
  contentLocale,
  defaultLocale,
}: NavSectionProps & { contentLocale: string; defaultLocale: string }) {
  const s = STR[uiLang()];

  const [products, setProducts] = useState<AdminPage[]>([]);
  const [categories, setCategories] = useState<ProductCategoriesValue>(EMPTY_CATEGORIES);
  const [allProductsId, setAllProductsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [mainFilter, setMainFilter] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(12);
  const [pageNum, setPageNum] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listAllPagesByType("product-item", contentLocale),
      fetchProjectSettings<ProductCategoriesValue>(PRODUCT_CATEGORIES_KEY)
        .then(({ value }) => normalizeCategories(value))
        .catch(() => EMPTY_CATEGORIES),
      getSingletonPageId("all-products").catch(() => null),
    ])
      .then(([items, cats, apId]) => {
        setProducts(items);
        setCategories(cats);
        setAllProductsId(apId);
      })
      .catch(() => notifications.show({ message: s.loadFailed, color: "red" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentLocale]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset paging when filters change.
  useEffect(() => {
    setPageNum(1);
  }, [search, mainFilter, subFilter, pageSize]);

  // Drop a subfilter that no longer belongs to the selected main.
  useEffect(() => {
    if (!mainFilter) return;
    const main = findMain(categories, mainFilter);
    if (subFilter && !main?.subcategories.some((sub) => sub.id === subFilter)) {
      setSubFilter(null);
    }
  }, [mainFilter, subFilter, categories]);

  const rows = useMemo(() => {
    return products.map((p) => {
      const data = readProductCategory(p, defaultLocale);
      const main = findMain(categories, data.mainCategoryId);
      const subPair = findSub(categories, data.subcategoryId);
      return {
        id: p.id,
        title: p.translations?.[contentLocale]?.title || p.title || "(untitled)",
        image: data.mainPhoto?.cdnUrl ?? null,
        status: p.status,
        mainId: main?.id ?? null,
        subId: subPair?.sub.id ?? null,
        mainLabel: main ? resolveCatLabel(main.label, contentLocale, defaultLocale) : "",
        subLabel: subPair ? resolveCatLabel(subPair.sub.label, contentLocale, defaultLocale) : "",
        updatedAt: p.updatedAt,
      };
    });
  }, [products, categories, contentLocale, defaultLocale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (mainFilter && r.mainId !== mainFilter) return false;
      if (subFilter && r.subId !== subFilter) return false;
      return true;
    });
  }, [rows, search, mainFilter, subFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(pageNum, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const mainOptions = useMemo(
    () =>
      categories.categories.map((c) => ({
        value: c.id,
        label: resolveCatLabel(c.label, contentLocale, defaultLocale) || s.untitledCat,
      })),
    [categories, contentLocale, defaultLocale, s.untitledCat],
  );
  const subOptions = useMemo(() => {
    const main = findMain(categories, mainFilter);
    const subs = main ? main.subcategories : categories.categories.flatMap((c) => c.subcategories);
    return subs.map((sub) => ({
      value: sub.id,
      label: resolveCatLabel(sub.label, contentLocale, defaultLocale) || s.untitledCat,
    }));
  }, [categories, mainFilter, contentLocale, defaultLocale, s.untitledCat]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePageById(deleteTarget.id);
      notifications.show({ message: s.deleted, color: "teal" });
      setDeleteTarget(null);
      load();
    } catch {
      notifications.show({ message: s.deleteFailed, color: "red" });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <Stack gap="md">
      {/* Toolbar */}
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group gap={10} align="flex-end" wrap="wrap">
          <TextInput
            leftSection={<Search size={15} />}
            placeholder={s.search}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={260}
          />
          <Select
            label={undefined}
            placeholder={s.filterMain}
            data={mainOptions}
            value={mainFilter}
            onChange={setMainFilter}
            clearable
            w={200}
            comboboxProps={{ withinPortal: true }}
          />
          <Select
            placeholder={s.filterSub}
            data={subOptions}
            value={subFilter}
            onChange={setSubFilter}
            clearable
            disabled={subOptions.length === 0}
            w={200}
            comboboxProps={{ withinPortal: true }}
          />
        </Group>
        <Tooltip
          label={s.noAllProducts}
          disabled={!!allProductsId}
          withArrow
          multiline
          w={260}
        >
          <span>
            <Button
              variant="primary"
              leftSection={<Plus size={16} />}
              disabled={!allProductsId}
              onClick={() => allProductsId && createPage("product-item", allProductsId)}
            >
              {s.addProduct}
            </Button>
          </span>
        </Tooltip>
      </Group>

      {filtered.length === 0 ? (
        <Text size="sm" c="dimmed" py="xl" ta="center">
          {products.length === 0 ? s.emptyProducts : s.emptyFiltered}
        </Text>
      ) : (
        <>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={56}>{s.colImage}</Table.Th>
                <Table.Th>{s.colName}</Table.Th>
                <Table.Th>{s.colMain}</Table.Th>
                <Table.Th>{s.colSub}</Table.Th>
                <Table.Th w={120}>{s.colStatus}</Table.Th>
                <Table.Th w={96} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paged.map((r) => (
                <Table.Tr
                  key={r.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => openPageEditor(r.id)}
                >
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    {r.image ? (
                      <Image src={r.image} w={40} h={40} radius="sm" fit="cover" alt="" />
                    ) : (
                      <Box
                        w={40}
                        h={40}
                        style={{
                          borderRadius: 6,
                          background: "var(--mantine-color-gray-1, #f1f3f5)",
                          display: "grid",
                          placeItems: "center",
                          color: "var(--mantine-color-gray-5, #adb5bd)",
                        }}
                      >
                        <Boxes size={18} />
                      </Box>
                    )}
                  </Table.Td>
                  <Table.Td><Text fw={500}>{r.title}</Text></Table.Td>
                  <Table.Td>
                    {r.mainLabel ? <Text size="sm">{r.mainLabel}</Text> : <Text size="sm" c="dimmed">{s.none}</Text>}
                  </Table.Td>
                  <Table.Td>
                    {r.subLabel ? <Text size="sm">{r.subLabel}</Text> : <Text size="sm" c="dimmed">{s.none}</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={r.status === "published" ? "teal" : "gray"}
                      variant={r.status === "published" ? "light" : "outline"}
                    >
                      {r.status === "published" ? s.statusPublished : s.statusDraft}
                    </Badge>
                  </Table.Td>
                  <Table.Td onClick={(e) => e.stopPropagation()}>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label={s.edit} withArrow>
                        <ActionIcon variant="subtle" onClick={() => openPageEditor(r.id)} aria-label={s.edit}>
                          <Pencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label={s.delete} withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => setDeleteTarget({ id: r.id, title: r.title })}
                          aria-label={s.delete}
                        >
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="space-between">
            <Group gap={8} align="center">
              <Text size="sm" c="dimmed">{s.perPage}</Text>
              <Select
                data={PAGE_SIZE_OPTIONS}
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v) || 12)}
                w={80}
                comboboxProps={{ withinPortal: true }}
              />
              <Text size="sm" c="dimmed">{filtered.length}</Text>
            </Group>
            {totalPages > 1 && (
              <Pagination total={totalPages} value={currentPage} onChange={setPageNum} size="sm" />
            )}
          </Group>
        </>
      )}

      <Modal opened={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={s.deleteTitle} centered size="sm">
        <Stack gap={14}>
          <Text size="sm">{deleteTarget ? s.deleteBody(deleteTarget.title) : ""}</Text>
          <Group justify="flex-end" gap={8}>
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>{s.cancel}</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={confirmDelete}>{s.delete}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ─── Screen shell (tabs) ──────────────────────────────────────────────────────

function ProductsScreen({ openPageEditor, createPage }: NavSectionProps) {
  const s = STR[uiLang()];
  const { locale: contentLocale, defaultLocale, availableLocales } = useContentLocale();
  const [tab, setTab] = useState<"products" | "categories">("products");

  return (
    <Box p="lg" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Text fw={700} fz={26} mb={4}>{s.title}</Text>

      {/* Lightweight segmented tabs (matches the app's pill style) */}
      <Group gap={6} mb="lg" mt="sm">
        <SegBtn active={tab === "products"} icon={<Boxes size={15} />} label={s.tabProducts} onClick={() => setTab("products")} />
        <SegBtn active={tab === "categories"} icon={<FolderTree size={15} />} label={s.tabCategories} onClick={() => setTab("categories")} />
      </Group>

      {tab === "products" ? (
        <ProductsTable
          openPageEditor={openPageEditor}
          createPage={createPage}
          contentLocale={contentLocale}
          defaultLocale={defaultLocale}
        />
      ) : (
        <CategoriesEditor availableLocales={availableLocales} defaultLocale={defaultLocale} />
      )}
    </Box>
  );
}

function SegBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        borderRadius: 999,
        border: "1px solid var(--cms-border, #e3e8ee)",
        background: active ? "var(--btn-primary-bg, #2dbfa4)" : "transparent",
        color: active ? "#fff" : "var(--cms-ink-2, #36506a)",
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export const productsNavSection: NavSectionDef = {
  key: "products",
  label: { en: "Products", hr: "Proizvodi" },
  icon: "Boxes",
  roles: ["developer", "admin", "editor"],
  component: ProductsScreen,
};
