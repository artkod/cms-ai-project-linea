import { useState, useMemo } from "react";
import {
  Accordion,
  ActionIcon,
  Box,
  Group,
  Image,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import {
  Button,
  IconButton,
  ImagePickerModal,
  RichTextEditor,
  type BlockEditorProps,
  type BlockTypeDefinition,
  type GalleryImage,
} from "@cms/admin-base";
import {
  Check,
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

interface ProductItemData {
  altTitle: string;
  mainPhoto: GalleryImage | null;
  galleryImages: GalleryImage[];
  description: string;
  priceEur: string;
  additionalInfo: {
    tabs: AdditionalInfoTab[];
  };
  konfiguratorCijene: {
    konstrukcija: KonstrukcijaRow[];
    grafika: GrafikaRow[];
    baza: BazaRow[];
  };
}

const PREDEFINED_TABS: Array<{ id: string; title: string }> = [
  { id: "vise-informacija", title: "Više informacija" },
  { id: "nasi-radovi", title: "Naši radovi" },
  { id: "tehnika-tiska", title: "Tehnika tiska" },
  { id: "upute-graficka-priprema", title: "Upute za grafičku pripremu" },
  { id: "upute-slaganje", title: "Upute za slaganje" },
];

const DEFAULT_DATA: ProductItemData = {
  altTitle: "",
  mainPhoto: null,
  galleryImages: [],
  description: "",
  priceEur: "",
  additionalInfo: {
    tabs: PREDEFINED_TABS.map((t) => ({ ...t, content: null })),
  },
  konfiguratorCijene: {
    konstrukcija: [],
    grafika: [],
    baza: [],
  },
};

const PRICE_HINT = "Format: do dvije decimale (npr. 12.34)";

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
    konfiguratorCijene: {
      konstrukcija: Array.isArray(kc.konstrukcija) ? kc.konstrukcija : [],
      grafika: Array.isArray(kc.grafika) ? kc.grafika : [],
      baza: Array.isArray(kc.baza) ? kc.baza : [],
    },
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
        <Text size="sm" fw={500}>Glavna fotografija</Text>
        {value ? (
          <Group align="flex-start" gap={12}>
            <Image
              src={value.cdnUrl}
              w={120}
              h={120}
              fit="cover"
              radius="sm"
              alt="Glavna fotografija"
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? null;

  function startRename(tab: AdditionalInfoTab) {
    setRenamingId(tab.id);
    setRenameDraft(tab.title);
  }
  function commitRename() {
    if (!renamingId) return;
    const next = tabs.map((t) =>
      t.id === renamingId ? { ...t, title: renameDraft.trim() || t.title } : t,
    );
    onChange(next);
    setRenamingId(null);
  }
  function cancelRename() {
    setRenamingId(null);
    setRenameDraft("");
  }
  function deleteTab(id: string) {
    const next = tabs.filter((t) => t.id !== id);
    onChange(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    setConfirmDeleteId(null);
  }
  function addTab() {
    const title = addDraft.trim();
    if (!title) return;
    const tab: AdditionalInfoTab = { id: uid(), title, content: null };
    onChange([...tabs, tab]);
    setActiveId(tab.id);
    setAdding(false);
    setAddDraft("");
  }
  function updateActiveContent(content: Record<string, unknown>) {
    if (!active) return;
    onChange(tabs.map((t) => (t.id === active.id ? { ...t, content } : t)));
  }

  const deleteTarget = confirmDeleteId
    ? tabs.find((t) => t.id === confirmDeleteId) ?? null
    : null;

  return (
    <Stack gap={8}>
      <SectionHeader title="Dodatne informacije" />
      <Group gap={6} wrap="wrap" align="center">
        {tabs.map((tab) => {
          const isActive = tab.id === active?.id;
          const isRenaming = tab.id === renamingId;
          return (
            <Group
              key={tab.id}
              gap={4}
              wrap="nowrap"
              align="center"
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                background: isActive ? "rgba(45,191,164,0.12)" : "var(--mantine-color-gray-1, #f1f3f5)",
                border: isActive ? "1px solid rgba(45,191,164,0.5)" : "1px solid transparent",
              }}
            >
              {isRenaming ? (
                <>
                  <TextInput
                    size="xs"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                    autoFocus
                    styles={{ input: { width: 180 } }}
                  />
                  <ActionIcon size="sm" variant="subtle" onClick={commitRename} aria-label="Spremi naziv">
                    <Check size={14} />
                  </ActionIcon>
                  <ActionIcon size="sm" variant="subtle" onClick={cancelRename} aria-label="Odustani">
                    <X size={14} />
                  </ActionIcon>
                </>
              ) : (
                <>
                  <Text
                    size="sm"
                    fw={isActive ? 600 : 500}
                    style={{ cursor: "pointer" }}
                    onClick={() => setActiveId(tab.id)}
                  >
                    {tab.title}
                  </Text>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => startRename(tab)}
                    aria-label="Preimenuj"
                  >
                    <Pencil size={12} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="red"
                    onClick={() => setConfirmDeleteId(tab.id)}
                    aria-label="Obriši"
                  >
                    <X size={12} />
                  </ActionIcon>
                </>
              )}
            </Group>
          );
        })}
        {adding ? (
          <Group gap={4} wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="Naziv novog tab-a"
              value={addDraft}
              onChange={(e) => setAddDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTab();
                if (e.key === "Escape") {
                  setAdding(false);
                  setAddDraft("");
                }
              }}
              autoFocus
              styles={{ input: { width: 180 } }}
            />
            <ActionIcon size="sm" variant="subtle" onClick={addTab} aria-label="Dodaj">
              <Check size={14} />
            </ActionIcon>
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => {
                setAdding(false);
                setAddDraft("");
              }}
              aria-label="Odustani"
            >
              <X size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            leftSection={<Plus size={14} />}
            onClick={() => setAdding(true)}
          >
            Dodaj tab
          </Button>
        )}
      </Group>

      {active ? (
        <Box
          style={{
            border: "1px solid var(--mantine-color-gray-3, #dee2e6)",
            borderRadius: 8,
            padding: 8,
            background: "white",
          }}
        >
          <RichTextEditor
            value={active.content}
            onChange={updateActiveContent}
            placeholder="Upiši sadržaj…"
            minHeight={160}
          />
        </Box>
      ) : (
        <Text size="xs" c="dimmed">Nema tab-ova. Dodaj prvi pomoću gumba iznad.</Text>
      )}

      <Modal
        opened={!!deleteTarget}
        onClose={() => setConfirmDeleteId(null)}
        title="Obriši tab"
        centered
        size="sm"
      >
        <Stack gap={12}>
          <Text size="sm">
            Sigurno želiš obrisati tab <strong>{deleteTarget?.title ?? ""}</strong>? Sadržaj ovog tab-a bit će izgubljen.
          </Text>
          <Group justify="flex-end" gap={8}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>
              Odustani
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteTarget && deleteTab(deleteTarget.id)}
            >
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
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  prefix?: string;
  placeholder?: string;
}) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={placeholder ?? "0.00"}
      description={PRICE_HINT}
      leftSection={prefix ? <Text size="xs" c="dimmed" pl={4}>{prefix}</Text> : undefined}
      leftSectionWidth={prefix ? Math.min(160, prefix.length * 7 + 16) : undefined}
    />
  );
}

function KonfiguratorCijene({
  value,
  onChange,
}: {
  value: ProductItemData["konfiguratorCijene"];
  onChange: (v: ProductItemData["konfiguratorCijene"]) => void;
}) {
  const { konstrukcija, grafika, baza } = value;

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
      <SectionHeader title="Konfigurator cijene" />
      <Accordion multiple defaultValue={["konstrukcija", "grafika", "baza"]} variant="separated">
        {/* ─── Konstrukcija ─────────────────────────────────────────────── */}
        <Accordion.Item value="konstrukcija">
          <Accordion.Control>
            <Group justify="space-between" pr="md">
              <Text fw={600}>Konstrukcija</Text>
              <Text size="xs" c="dimmed">{konstrukcija.length} {konstrukcija.length === 1 ? "stavka" : "stavki"}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={12}>
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

        {/* ─── Grafika ──────────────────────────────────────────────────── */}
        <Accordion.Item value="grafika">
          <Accordion.Control>
            <Group justify="space-between" pr="md">
              <Text fw={600}>Grafika</Text>
              <Text size="xs" c="dimmed">{grafika.length} {grafika.length === 1 ? "stavka" : "stavki"}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={16}>
              {grafika.map((row) => (
                <Box
                  key={row.id}
                  style={{
                    border: "1px solid var(--mantine-color-gray-3, #dee2e6)",
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
                    {konstrukcija.length === 0 ? (
                      <Text size="xs" c="dimmed">
                        Dodaj stavku u Konstrukciji da bi se ovdje pojavila polja za cijenu.
                      </Text>
                    ) : (
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
                    )}
                  </Stack>
                </Box>
              ))}
              <Group>
                <Button variant="secondary" size="sm" leftSection={<Plus size={14} />} onClick={addGrafika}>
                  Dodaj stavku
                </Button>
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        {/* ─── Baza ─────────────────────────────────────────────────────── */}
        <Accordion.Item value="baza">
          <Accordion.Control>
            <Group justify="space-between" pr="md">
              <Text fw={600}>Baza</Text>
              <Text size="xs" c="dimmed">{baza.length} {baza.length === 1 ? "stavka" : "stavki"}</Text>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap={12}>
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
    </Stack>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function ProductItemEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);

  function patch(p: Partial<ProductItemData>) {
    onChange({ ...d, ...p } as unknown as Record<string, unknown>);
  }

  return (
    <Stack gap={20}>
      {/* Basics */}
      <Stack gap={10}>
        <SectionHeader title="Osnovni podaci" />
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
