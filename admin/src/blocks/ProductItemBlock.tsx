import { useEffect, useState, useMemo, useRef } from "react";
import {
  Accordion,
  ActionIcon,
  Box,
  Checkbox,
  Group,
  Image,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  Button,
  IconButton,
  ImagePickerModal,
  RichTextEditor,
  fetchProjectSettings,
  useContentLocale,
  type BlockEditorProps,
  type BlockTypeDefinition,
  type GalleryImage,
} from "@cms/admin-base";
import {
  PRODUCT_CATEGORIES_KEY,
  EMPTY_CATEGORIES,
  normalizeCategories,
  resolveCatLabel,
  findMain,
  type ProductCategoriesValue,
} from "../products/categoryModel";
import { listAllPagesByType, type AdminPage } from "../lib/adminApi";
import {
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ─── Data model ──────────────────────────────────────────────────────────────

interface AdditionalInfoTab {
  id: string;
  title: string;
  content: Record<string, unknown> | null;
}

interface KonstrukcijaRow {
  id: string;
  naziv: string;
  cijena: string;
}

interface GrafikaRow {
  id: string;
  naziv: string;
  cijene: Record<string, string>;
}

interface BazaRow {
  id: string;
  naziv: string;
  cijena: string;
}

interface KonfiguratorData {
  /** Master toggle. Unchecked by default — the standalone price field is the
   *  active pricing input until the editor explicitly turns the configurator
   *  on (which then disables the price field). */
  enabled: boolean;
  /** Customer-facing titles for the three groups. Empty by default; required
   *  once the configurator is enabled. The internal keys (konstrukcija /
   *  grafika / baza) stay fixed — only the displayed labels are editable. */
  group1Label: string;
  group2Label: string;
  group3Label: string;
  /** Group 1 — the driver. Flat priced rows. */
  konstrukcija: KonstrukcijaRow[];
  /** Group 2 — depends on group 1: one price per group-1 row, disabled until
   *  group 1 has at least one item. */
  grafika: GrafikaRow[];
  /** Group 3 — independent, always available. Flat priced rows. */
  baza: BazaRow[];
}

interface ProductItemData {
  /** Main category id — references an entry in the `product_categories`
   *  project-setting. Replaces the old product-category parent page. */
  mainCategoryId: string | null;
  /** Subcategory id — references a subcategory under `mainCategoryId`. */
  subcategoryId: string | null;
  altTitle: string;
  mainPhoto: GalleryImage | null;
  galleryImages: GalleryImage[];
  description: string;
  priceEur: string;
  additionalInfo: {
    tabs: AdditionalInfoTab[];
  };
  konfiguratorCijene: KonfiguratorData;
  featuredOnHome: boolean;
}

const PREDEFINED_TABS: Array<{ id: string; title: string }> = [
  { id: "vise-informacija", title: "Više informacija" },
  { id: "nasi-radovi", title: "Naši radovi" },
  { id: "tehnika-tiska", title: "Tehnika tiska" },
  { id: "upute-graficka-priprema", title: "Upute za grafičku pripremu" },
  { id: "upute-slaganje", title: "Upute za slaganje" },
];

const DEFAULT_DATA: ProductItemData = {
  mainCategoryId: null,
  subcategoryId: null,
  altTitle: "",
  mainPhoto: null,
  galleryImages: [],
  description: "",
  priceEur: "",
  additionalInfo: {
    tabs: PREDEFINED_TABS.map((t) => ({ ...t, content: null })),
  },
  konfiguratorCijene: {
    enabled: false,
    group1Label: "",
    group2Label: "",
    group3Label: "",
    konstrukcija: [],
    grafika: [],
    baza: [],
  },
  featuredOnHome: false,
};

const PRICE_HINT = "Format: do dvije decimale (npr. 12.34)";

// Homepage "featured products" section has 4 card slots — once 4 products are
// pinned, the checkbox locks on every other product.
const MAX_FEATURED_ON_HOME = 4;

// featuredOnHome is per-locale block data (like the category ids); treat the
// page as featured when ANY locale's product-item block carries the flag.
function pageIsFeaturedOnHome(p: AdminPage): boolean {
  const blockLists = [
    p.blocks ?? [],
    ...Object.values(p.translations ?? {}).map((t) => t.blocks ?? []),
  ];
  return blockLists.some((blocks) =>
    blocks.some((b) => b.type === "product-item" && b.data?.featuredOnHome === true)
  );
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Coerce arbitrary stored data (including partial / legacy shapes) into the
// full ProductItemData shape so the editor doesn't crash on first render.
function normalize(raw: Record<string, unknown>): ProductItemData {
  const r = raw as Partial<ProductItemData>;
  const ai = (r.additionalInfo ?? {}) as Partial<ProductItemData["additionalInfo"]>;
  const kc = (r.konfiguratorCijene ?? {}) as Partial<ProductItemData["konfiguratorCijene"]>;
  return {
    mainCategoryId: typeof r.mainCategoryId === "string" ? r.mainCategoryId : null,
    subcategoryId: typeof r.subcategoryId === "string" ? r.subcategoryId : null,
    altTitle: typeof r.altTitle === "string" ? r.altTitle : "",
    mainPhoto: r.mainPhoto ?? null,
    galleryImages: Array.isArray(r.galleryImages) ? r.galleryImages : [],
    description: typeof r.description === "string" ? r.description : "",
    priceEur: typeof r.priceEur === "string" ? r.priceEur : "",
    additionalInfo: {
      tabs: Array.isArray(ai.tabs) && ai.tabs.length > 0
        ? ai.tabs.map((t) => ({
            id: t.id ?? uid(),
            title: typeof t.title === "string" ? t.title : "",
            content: (t.content ?? null) as Record<string, unknown> | null,
          }))
        : PREDEFINED_TABS.map((t) => ({ ...t, content: null })),
    },
    konfiguratorCijene: (() => {
      const konstrukcija = Array.isArray(kc.konstrukcija) ? kc.konstrukcija : [];
      const grafika = Array.isArray(kc.grafika) ? kc.grafika : [];
      const baza = Array.isArray(kc.baza) ? kc.baza : [];
      const hasData = konstrukcija.length + grafika.length + baza.length > 0;
      // Legacy rows (saved before the toggle existed) have no `enabled` flag:
      // turn the configurator on iff they already carry configurator data, so
      // fixed-price-only products keep their price field active.
      const enabled = typeof kc.enabled === "boolean" ? kc.enabled : hasData;
      return {
        enabled,
        group1Label: typeof kc.group1Label === "string" ? kc.group1Label : "",
        group2Label: typeof kc.group2Label === "string" ? kc.group2Label : "",
        group3Label: typeof kc.group3Label === "string" ? kc.group3Label : "",
        konstrukcija,
        grafika,
        baza,
      };
    })(),
    featuredOnHome: typeof r.featuredOnHome === "boolean" ? r.featuredOnHome : false,
  };
}

// ─── Section header (visual divider inside the block body) ───────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      size="sm"
      fw={700}
      style={{
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--cms-ink-3, #6c7686)",
      }}
    >
      {title}
    </Text>
  );
}

// ─── Main photo picker ───────────────────────────────────────────────────────

function MainPhotoPicker({
  value,
  onChange,
}: {
  value: GalleryImage | null;
  onChange: (v: GalleryImage | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stack gap={6}>
        <Text size="sm" fw={500}>Glavna slika</Text>
        {value ? (
          <Group align="flex-start" gap={12}>
            <Image
              src={value.cdnUrl}
              w={120}
              h={120}
              fit="cover"
              radius="sm"
              alt="Glavna slika"
            />
            <Stack gap={6}>
              <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
                Promijeni
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
                Ukloni
              </Button>
            </Stack>
          </Group>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            leftSection={<Upload size={14} />}
            onClick={() => setOpen(true)}
          >
            Odaberi fotografiju
          </Button>
        )}
      </Stack>
      <ImagePickerModal
        opened={open}
        onClose={() => setOpen(false)}
        title="Odaberi glavnu fotografiju"
        mode="single"
        onConfirm={(imgs) => {
          if (imgs[0]) onChange(imgs[0]);
          setOpen(false);
        }}
      />
    </>
  );
}

// ─── Gallery picker ──────────────────────────────────────────────────────────

function GalleryPicker({
  value,
  onChange,
}: {
  value: GalleryImage[];
  onChange: (v: GalleryImage[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stack gap={6}>
        <Text size="sm" fw={500}>Galerija</Text>
        {value.length > 0 ? (
          <Group gap={8} wrap="wrap">
            {value.map((img) => (
              <Box key={img.mediaId} style={{ position: "relative" }}>
                <Image
                  src={img.cdnUrl}
                  w={84}
                  h={84}
                  fit="cover"
                  radius="sm"
                  alt=""
                />
                <ActionIcon
                  variant="filled"
                  color="dark"
                  size="xs"
                  radius="xl"
                  style={{ position: "absolute", top: -6, right: -6 }}
                  onClick={() =>
                    onChange(value.filter((v) => v.mediaId !== img.mediaId))
                  }
                  aria-label="Ukloni iz galerije"
                >
                  <X size={12} />
                </ActionIcon>
              </Box>
            ))}
          </Group>
        ) : (
          <Text size="xs" c="dimmed">Još nema slika u galeriji.</Text>
        )}
        <Group gap={8}>
          <Button
            variant="secondary"
            size="sm"
            leftSection={<Upload size={14} />}
            onClick={() => setOpen(true)}
          >
            {value.length > 0 ? "Uredi galeriju" : "Dodaj slike"}
          </Button>
        </Group>
      </Stack>
      <ImagePickerModal
        opened={open}
        onClose={() => setOpen(false)}
        title="Odaberi slike za galeriju"
        mode="multi"
        initialImages={value}
        onConfirm={(imgs) => {
          onChange(imgs);
          setOpen(false);
        }}
      />
    </>
  );
}

// ─── Additional info: tab strip + RTE per tab ────────────────────────────────

function AdditionalInfoTabs({
  tabs,
  onChange,
}: {
  tabs: AdditionalInfoTab[];
  onChange: (tabs: AdditionalInfoTab[]) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(tabs[0]?.id ?? null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState("");

  // Keep activeId valid when the tab list changes (e.g. external paste of data).
  const effectiveActive = activeId && tabs.some((t) => t.id === activeId)
    ? activeId
    : tabs[0]?.id ?? null;

  function openRename(tab: AdditionalInfoTab) {
    setRenameId(tab.id);
    setRenameDraft(tab.title);
  }
  function commitRename() {
    if (!renameId) return;
    const value = renameDraft.trim();
    if (!value) {
      setRenameId(null);
      return;
    }
    onChange(tabs.map((t) => (t.id === renameId ? { ...t, title: value } : t)));
    setRenameId(null);
  }

  function commitDelete() {
    if (!deleteId) return;
    const next = tabs.filter((t) => t.id !== deleteId);
    onChange(next);
    if (effectiveActive === deleteId) setActiveId(next[0]?.id ?? null);
    setDeleteId(null);
  }

  function commitAdd() {
    const title = addDraft.trim();
    if (!title) return;
    const tab: AdditionalInfoTab = { id: uid(), title, content: null };
    onChange([...tabs, tab]);
    setActiveId(tab.id);
    setAddOpen(false);
    setAddDraft("");
  }

  function updateContent(id: string, content: Record<string, unknown>) {
    onChange(tabs.map((t) => (t.id === id ? { ...t, content } : t)));
  }

  const renameTarget = renameId ? tabs.find((t) => t.id === renameId) ?? null : null;
  const deleteTarget = deleteId ? tabs.find((t) => t.id === deleteId) ?? null : null;

  // Mantine Tabs treats null/missing value gracefully; coerce to "" so the
  // controlled value type matches when there are no tabs left.
  const tabsValue = effectiveActive ?? "";

  return (
    <Stack gap={10}>
      <SectionHeader title="Dodatne informacije" />

      {tabs.length === 0 ? (
        <Group>
          <Text size="sm" c="dimmed">Još nema tab-ova.</Text>
          <Button
            variant="secondary"
            size="sm"
            leftSection={<Plus size={14} />}
            onClick={() => setAddOpen(true)}
          >
            Dodaj tab
          </Button>
        </Group>
      ) : (
        <Tabs
          value={tabsValue}
          onChange={(v) => v && setActiveId(v)}
          variant="default"
          keepMounted={false}
        >
          {/* Tabs.List `grow` distributes width across the Tabs.Tab children
              so every tab takes the same slice of the row. We force
              `flex-wrap: nowrap` on the list itself (Mantine's default
              allows wrap) and set `minWidth: 0` + label ellipsis on each
              tab so long titles truncate instead of pushing the row to a
              second line. The "+" Add button is rendered outside Tabs.List
              (in the same flex row) so it isn't part of the equal-width
              distribution. A Tooltip on each tab surfaces the full title
              on hover when the label is ellipsised. */}
          <Group wrap="nowrap" gap={4} align="stretch">
            <Tabs.List
              grow
              style={{ flex: 1, minWidth: 0, flexWrap: "nowrap" }}
            >
              {tabs.map((tab) => (
                <Tooltip
                  key={tab.id}
                  label={tab.title || "(bez naziva)"}
                  openDelay={400}
                  withArrow
                  withinPortal
                >
                  <Tabs.Tab
                    value={tab.id}
                    styles={{
                      tab: { minWidth: 0, flex: "1 1 0" },
                      tabLabel: {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        minWidth: 0,
                      },
                    }}
                    rightSection={
                      <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            openRename(tab);
                          }}
                          aria-label="Preimenuj"
                        >
                          <Pencil size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDeleteId(tab.id);
                          }}
                          aria-label="Obriši"
                        >
                          <X size={12} />
                        </ActionIcon>
                      </Group>
                    }
                  >
                    {tab.title || "(bez naziva)"}
                  </Tabs.Tab>
                </Tooltip>
              ))}
            </Tabs.List>
            <ActionIcon
              size="lg"
              variant="subtle"
              onClick={() => setAddOpen(true)}
              aria-label="Dodaj tab"
              style={{ alignSelf: "center", flexShrink: 0 }}
            >
              <Plus size={16} />
            </ActionIcon>
          </Group>

          {tabs.map((tab) => (
            <Tabs.Panel key={tab.id} value={tab.id} pt="sm">
              <Box
                style={{
                  border: "1px solid var(--cms-border, #dee2e6)",
                  borderRadius: 8,
                  padding: 8,
                  background: "var(--cms-surface, #fff)",
                }}
              >
                <RichTextEditor
                  value={tab.content}
                  onChange={(c) => updateContent(tab.id, c)}
                  placeholder="Upiši sadržaj…"
                  minHeight={160}
                />
              </Box>
            </Tabs.Panel>
          ))}
        </Tabs>
      )}

      {/* ─── Rename modal ─── */}
      <Modal
        opened={!!renameTarget}
        onClose={() => setRenameId(null)}
        title="Preimenuj tab"
        centered
        size="sm"
      >
        <Stack gap={12}>
          <TextInput
            label="Novi naziv"
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenameId(null);
            }}
            autoFocus
          />
          <Group justify="flex-end" gap={8}>
            <Button variant="secondary" size="sm" onClick={() => setRenameId(null)}>
              Odustani
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={commitRename}
              disabled={!renameDraft.trim()}
            >
              Spremi
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Add modal ─── */}
      <Modal
        opened={addOpen}
        onClose={() => {
          setAddOpen(false);
          setAddDraft("");
        }}
        title="Dodaj tab"
        centered
        size="sm"
      >
        <Stack gap={12}>
          <TextInput
            label="Naziv tab-a"
            value={addDraft}
            onChange={(e) => setAddDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") {
                setAddOpen(false);
                setAddDraft("");
              }
            }}
            autoFocus
          />
          <Group justify="flex-end" gap={8}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAddOpen(false);
                setAddDraft("");
              }}
            >
              Odustani
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={commitAdd}
              disabled={!addDraft.trim()}
            >
              Dodaj
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ─── Delete confirm modal ─── */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteId(null)}
        title="Obriši tab"
        centered
        size="sm"
      >
        <Stack gap={12}>
          <Text size="sm">
            Sigurno želiš obrisati tab <strong>{deleteTarget?.title ?? ""}</strong>? Sadržaj ovog tab-a bit će izgubljen.
          </Text>
          <Group justify="flex-end" gap={8}>
            <Button variant="secondary" size="sm" onClick={() => setDeleteId(null)}>
              Odustani
            </Button>
            <Button variant="danger" size="sm" onClick={commitDelete}>
              Obriši
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ─── Konfigurator cijene: 3 accordions ───────────────────────────────────────

function PriceInput({
  value,
  onChange,
  label,
  prefix,
  placeholder,
  disabled,
  description,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  prefix?: string;
  placeholder?: string;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder ?? "0.00"}
      description={description ?? PRICE_HINT}
      disabled={disabled}
      leftSection={prefix ? <Text size="xs" c="dimmed" pl={4}>{prefix}</Text> : undefined}
      leftSectionWidth={prefix ? Math.min(160, prefix.length * 7 + 16) : undefined}
    />
  );
}

const GROUP_LABEL_REQUIRED = "Naziv grupe je obavezan kad je konfigurator uključen.";

function KonfiguratorCijene({
  value,
  onChange,
}: {
  value: ProductItemData["konfiguratorCijene"];
  onChange: (v: ProductItemData["konfiguratorCijene"]) => void;
}) {
  const { enabled, group1Label, group2Label, group3Label, konstrukcija, grafika, baza } = value;
  // Group 2 can't hold prices until group 1 has at least one item to key them by.
  const group2Locked = konstrukcija.length === 0;
  // A group's label is only required when the configurator is on AND the group
  // actually has at least one item — an empty group isn't rendered on the
  // frontend, so its title is irrelevant.
  const labelError = (v: string, count: number) =>
    enabled && count > 0 && !v.trim() ? GROUP_LABEL_REQUIRED : undefined;

  // ─── Konstrukcija ──────────────────────────────────────────────────────
  function addKonstrukcija() {
    const row: KonstrukcijaRow = { id: uid(), naziv: "", cijena: "" };
    onChange({ ...value, konstrukcija: [...konstrukcija, row] });
  }
  function updateKonstrukcija(id: string, patch: Partial<KonstrukcijaRow>) {
    onChange({
      ...value,
      konstrukcija: konstrukcija.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }
  function removeKonstrukcija(id: string) {
    // Drop the column from every Grafika row's cijene map too.
    const nextGrafika = grafika.map((g) => {
      const { [id]: _drop, ...rest } = g.cijene;
      return { ...g, cijene: rest };
    });
    onChange({
      ...value,
      konstrukcija: konstrukcija.filter((r) => r.id !== id),
      grafika: nextGrafika,
    });
  }

  // ─── Grafika ───────────────────────────────────────────────────────────
  function addGrafika() {
    const row: GrafikaRow = { id: uid(), naziv: "", cijene: {} };
    onChange({ ...value, grafika: [...grafika, row] });
  }
  function updateGrafikaNaziv(id: string, naziv: string) {
    onChange({
      ...value,
      grafika: grafika.map((r) => (r.id === id ? { ...r, naziv } : r)),
    });
  }
  function updateGrafikaCijena(grafikaId: string, konstrukcijaId: string, cijena: string) {
    onChange({
      ...value,
      grafika: grafika.map((r) =>
        r.id === grafikaId ? { ...r, cijene: { ...r.cijene, [konstrukcijaId]: cijena } } : r,
      ),
    });
  }
  function removeGrafika(id: string) {
    onChange({ ...value, grafika: grafika.filter((r) => r.id !== id) });
  }

  // ─── Baza ──────────────────────────────────────────────────────────────
  function addBaza() {
    const row: BazaRow = { id: uid(), naziv: "", cijena: "" };
    onChange({ ...value, baza: [...baza, row] });
  }
  function updateBaza(id: string, patch: Partial<BazaRow>) {
    onChange({
      ...value,
      baza: baza.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }
  function removeBaza(id: string) {
    onChange({ ...value, baza: baza.filter((r) => r.id !== id) });
  }

  return (
    <Stack gap={8}>
      <Checkbox
        checked={enabled}
        onChange={(e) => onChange({ ...value, enabled: e.currentTarget.checked })}
        label={<SectionHeader title="Konfigurator cijene" />}
      />
      {/* Native fieldset disables every nested input/button in one shot when the
          configurator is off, so the whole block greys out without threading a
          `disabled` prop through every control. */}
      <Box
        component="fieldset"
        disabled={!enabled}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minInlineSize: 0,
          opacity: enabled ? 1 : 0.55,
          transition: "opacity 0.15s ease",
        }}
      >
      <Accordion multiple defaultValue={["konstrukcija", "grafika", "baza"]} variant="separated">
        {/* ─── Group 1 (Konstrukcija) ───────────────────────────────────── */}
        <Accordion.Item value="konstrukcija">
          <Accordion.Control>
            <Group justify="space-between" pr="md">
              <Text fw={600}>{group1Label.trim()}</Text>
              <Text size="xs" c="dimmed">{konstrukcija.length} {konstrukcija.length === 1 ? "stavka" : "stavki"}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={12}>
              <TextInput
                label="Naziv grupe (prikazuje se kupcu)"
                placeholder="npr. Konstrukcija"
                value={group1Label}
                onChange={(e) => onChange({ ...value, group1Label: e.currentTarget.value })}
                withAsterisk={enabled && konstrukcija.length > 0}
                error={labelError(group1Label, konstrukcija.length)}
              />
              {konstrukcija.map((row) => (
                <Group key={row.id} gap={8} align="flex-end" wrap="nowrap">
                  <TextInput
                    label="Naziv"
                    value={row.naziv}
                    onChange={(e) => updateKonstrukcija(row.id, { naziv: e.currentTarget.value })}
                    style={{ flex: 1 }}
                  />
                  <Box style={{ flex: 1 }}>
                    <PriceInput
                      label="Cijena (EUR)"
                      value={row.cijena}
                      onChange={(v) => updateKonstrukcija(row.id, { cijena: v })}
                    />
                  </Box>
                  <IconButton
                    label="Ukloni"
                    variant="danger"
                    onClick={() => removeKonstrukcija(row.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Group>
              ))}
              <Group>
                <Button variant="secondary" size="sm" leftSection={<Plus size={14} />} onClick={addKonstrukcija}>
                  Dodaj stavku
                </Button>
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* ─── Group 2 (Grafika) — depends on group 1 ───────────────────── */}
        <Accordion.Item value="grafika">
          <Accordion.Control>
            <Group justify="space-between" pr="md">
              <Text fw={600}>{group2Label.trim()}</Text>
              <Text size="xs" c="dimmed">{grafika.length} {grafika.length === 1 ? "stavka" : "stavki"}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            {/* Inner fieldset locks group 2 whenever group 1 is empty, even
                while the configurator itself is enabled. */}
            <Box
              component="fieldset"
              disabled={group2Locked}
              style={{ border: 0, padding: 0, margin: 0, minInlineSize: 0, opacity: group2Locked ? 0.55 : 1 }}
            >
            <Stack gap={16}>
              <TextInput
                label="Naziv grupe (prikazuje se kupcu)"
                placeholder="npr. Grafika"
                value={group2Label}
                onChange={(e) => onChange({ ...value, group2Label: e.currentTarget.value })}
                withAsterisk={enabled && grafika.length > 0}
                error={labelError(group2Label, grafika.length)}
              />
              {group2Locked && (
                <Text size="xs" c="dimmed">
                  Dodaj barem jednu stavku u 1. grupu da omogućiš ovu grupu.
                </Text>
              )}
              {grafika.map((row) => (
                <Box
                  key={row.id}
                  style={{
                    border: "1px solid var(--cms-border, #dee2e6)",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <Stack gap={10}>
                    <Group gap={8} align="flex-end" wrap="nowrap">
                      <TextInput
                        label="Naziv"
                        value={row.naziv}
                        onChange={(e) => updateGrafikaNaziv(row.id, e.currentTarget.value)}
                        style={{ flex: 1 }}
                      />
                      <IconButton
                        label="Ukloni"
                        variant="danger"
                        onClick={() => removeGrafika(row.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Group>
                    <Stack gap={8}>
                      {konstrukcija.map((k) => (
                        <PriceInput
                          key={k.id}
                          label={`Cijena (EUR) — ${k.naziv || "(bez naziva)"}`}
                          value={row.cijene[k.id] ?? ""}
                          onChange={(v) => updateGrafikaCijena(row.id, k.id, v)}
                          prefix={k.naziv || "(bez naziva)"}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Box>
              ))}
              <Group>
                <Button variant="secondary" size="sm" leftSection={<Plus size={14} />} onClick={addGrafika}>
                  Dodaj stavku
                </Button>
              </Group>
            </Stack>
            </Box>
          </Accordion.Panel>
        </Accordion.Item>

        {/* ─── Group 3 (Baza) — independent ─────────────────────────────── */}
        <Accordion.Item value="baza">
          <Accordion.Control>
            <Group justify="space-between" pr="md">
              <Text fw={600}>{group3Label.trim()}</Text>
              <Text size="xs" c="dimmed">{baza.length} {baza.length === 1 ? "stavka" : "stavki"}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={12}>
              <TextInput
                label="Naziv grupe (prikazuje se kupcu)"
                placeholder="npr. Baza"
                value={group3Label}
                onChange={(e) => onChange({ ...value, group3Label: e.currentTarget.value })}
                withAsterisk={enabled && baza.length > 0}
                error={labelError(group3Label, baza.length)}
              />
              {baza.map((row) => (
                <Group key={row.id} gap={8} align="flex-end" wrap="nowrap">
                  <TextInput
                    label="Naziv"
                    value={row.naziv}
                    onChange={(e) => updateBaza(row.id, { naziv: e.currentTarget.value })}
                    style={{ flex: 1 }}
                  />
                  <Box style={{ flex: 1 }}>
                    <PriceInput
                      label="Cijena (EUR)"
                      value={row.cijena}
                      onChange={(v) => updateBaza(row.id, { cijena: v })}
                    />
                  </Box>
                  <IconButton
                    label="Ukloni"
                    variant="danger"
                    onClick={() => removeBaza(row.id)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </Group>
              ))}
              <Group>
                <Button variant="secondary" size="sm" leftSection={<Plus size={14} />} onClick={addBaza}>
                  Dodaj stavku
                </Button>
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      </Box>
    </Stack>
  );
}

// ─── Category section: cascading main → sub dropdowns ────────────────────────
//
// Reads the `product_categories` taxonomy from the project-settings store. The
// subcategory select is disabled until a main category is chosen, and its
// options narrow to the selected main's subcategories. Replaces the old
// product/product-category parent pages — category is now data on the product.

function CategorySection({
  mainCategoryId,
  subcategoryId,
  onChange,
}: {
  mainCategoryId: string | null;
  subcategoryId: string | null;
  onChange: (patch: { mainCategoryId?: string | null; subcategoryId?: string | null }) => void;
}) {
  const { locale, defaultLocale } = useContentLocale();
  const [cats, setCats] = useState<ProductCategoriesValue>(EMPTY_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchProjectSettings<ProductCategoriesValue>(PRODUCT_CATEGORIES_KEY)
      .then(({ value }) => {
        if (!cancelled) setCats(normalizeCategories(value));
      })
      .catch(() => {
        /* leave empty */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mainOptions = cats.categories.map((c) => ({
    value: c.id,
    label: resolveCatLabel(c.label, locale, defaultLocale) || "(bez naziva)",
  }));
  const selectedMain = findMain(cats, mainCategoryId);
  const subOptions = (selectedMain?.subcategories ?? []).map((sub) => ({
    value: sub.id,
    label: resolveCatLabel(sub.label, locale, defaultLocale) || "(bez naziva)",
  }));

  const noCats = !loading && cats.categories.length === 0;

  return (
    <Stack gap={10}>
      <SectionHeader title="Kategorija" />
      {noCats ? (
        <Text size="xs" c="dimmed">
          Još nema kategorija. Dodajte ih u izborniku „Proizvodi” → „Kategorije”.
        </Text>
      ) : (
        <Group gap={12} grow align="flex-start">
          <Select
            label="Glavna kategorija"
            placeholder={loading ? "Učitavanje…" : "Odaberi kategoriju"}
            data={mainOptions}
            value={mainCategoryId}
            disabled={loading}
            onChange={(v) => onChange({ mainCategoryId: v, subcategoryId: null })}
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
          />
          <Select
            label="Potkategorija"
            placeholder={!mainCategoryId ? "Prvo odaberi glavnu kategoriju" : "Odaberi potkategoriju"}
            data={subOptions}
            value={subcategoryId}
            disabled={loading || !mainCategoryId || subOptions.length === 0}
            onChange={(v) => onChange({ subcategoryId: v })}
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
          />
        </Group>
      )}
    </Stack>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function ProductItemEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);

  // Global featured cap. The block editor doesn't know its own page id, so we
  // count featured products across ALL saved product-items and subtract this
  // product's own saved flag (captured on first render, before any edits).
  // Best-effort, like the group-title validation: the count is a snapshot from
  // editor-open, so two editors saving simultaneously can still exceed the cap
  // — the homepage then shows the 4 newest featured items and ignores the rest.
  const wasFeaturedOnLoad = useRef<boolean | null>(null);
  if (wasFeaturedOnLoad.current === null) wasFeaturedOnLoad.current = d.featuredOnHome;
  // "loading" keeps the checkbox locked from the first render (no unlocked→
  // locked flash while the count is in flight); a fetch failure unlocks it
  // (fail-open) rather than falsely blocking the editor.
  const [featuredTotal, setFeaturedTotal] = useState<number | "loading" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    listAllPagesByType("product-item")
      .then((pages) => {
        if (!cancelled) setFeaturedTotal(pages.filter(pageIsFeaturedOnHome).length);
      })
      .catch(() => {
        if (!cancelled) setFeaturedTotal("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const othersFeatured =
    typeof featuredTotal === "number"
      ? featuredTotal - (wasFeaturedOnLoad.current ? 1 : 0)
      : null;
  const featuredCountLoading = featuredTotal === "loading";
  const featuredLocked =
    !d.featuredOnHome &&
    (featuredCountLoading || (othersFeatured !== null && othersFeatured >= MAX_FEATURED_ON_HOME));

  function patch(p: Partial<ProductItemData>) {
    onChange({ ...d, ...p } as unknown as Record<string, unknown>);
  }

  return (
    <Stack gap={20}>
      {/* Category (main → sub) */}
      <CategorySection
        mainCategoryId={d.mainCategoryId}
        subcategoryId={d.subcategoryId}
        onChange={(p) => patch(p)}
      />

      {/* Basics */}
      <Stack gap={10}>
        <SectionHeader title="Osnovni podaci" />
        <Checkbox
          label="Istaknuto na naslovnici"
          description={
            featuredCountLoading
              ? "Provjera broja istaknutih proizvoda…"
              : featuredLocked
                ? `Već je odabrano ${MAX_FEATURED_ON_HOME} istaknutih proizvoda — odznačite jedan od postojećih da biste mogli istaknuti ovaj.`
                : "Prikaži ovaj proizvod među istaknutima na početnoj stranici."
          }
          checked={d.featuredOnHome}
          disabled={featuredLocked}
          onChange={(e) => patch({ featuredOnHome: e.currentTarget.checked })}
        />
        <TextInput
          label="Alternativni naslov"
          placeholder="Alternativni naslov (opcionalno)"
          value={d.altTitle}
          onChange={(e) => patch({ altTitle: e.currentTarget.value })}
        />
        <MainPhotoPicker
          value={d.mainPhoto}
          onChange={(v) => patch({ mainPhoto: v })}
        />
        <GalleryPicker
          value={d.galleryImages}
          onChange={(v) => patch({ galleryImages: v })}
        />
        <Textarea
          label="Opis proizvoda"
          placeholder="Opis proizvoda (običan tekst, bez formatiranja)"
          value={d.description}
          onChange={(e) => patch({ description: e.currentTarget.value })}
          autosize
          minRows={3}
          maxRows={10}
        />
        <Box maw={260}>
          <PriceInput
            label="Cijena (EUR)"
            value={d.priceEur}
            onChange={(v) => patch({ priceEur: v })}
            disabled={d.konfiguratorCijene.enabled}
            description={
              d.konfiguratorCijene.enabled
                ? "Onemogućeno dok je konfigurator cijene uključen."
                : undefined
            }
          />
        </Box>
      </Stack>

      {/* Additional info */}
      <AdditionalInfoTabs
        tabs={d.additionalInfo.tabs}
        onChange={(tabs) => patch({ additionalInfo: { tabs } })}
      />

      {/* Konfigurator cijene */}
      <KonfiguratorCijene
        value={d.konfiguratorCijene}
        onChange={(v) => patch({ konfiguratorCijene: v })}
      />
    </Stack>
  );
}

export const productItemBlock: BlockTypeDefinition = {
  type: "product-item",
  label: "Product item",
  defaultData: DEFAULT_DATA as unknown as Record<string, unknown>,
  EditorComponent: ProductItemEditor,
  getLabel: (data) => {
    const d = normalize(data);
    return d.altTitle?.trim() || "Product item";
  },
};
