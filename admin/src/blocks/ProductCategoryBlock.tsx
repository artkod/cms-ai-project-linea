import { useMemo, useState } from "react";
import { Group, Image, Stack, Text, TextInput } from "@mantine/core";
import {
  Button,
  ImagePickerModal,
  type BlockEditorProps,
  type BlockTypeDefinition,
  type GalleryImage,
} from "@cms/admin-base";
import { Upload } from "lucide-react";

// ─── Data model ──────────────────────────────────────────────────────────────

interface ProductCategoryData {
  altTitle: string;
  mainImage: GalleryImage | null;
  altImage: GalleryImage | null;
}

const DEFAULT_DATA: ProductCategoryData = {
  altTitle: "",
  mainImage: null,
  altImage: null,
};

// Coerce arbitrary stored data (including partial / legacy shapes) into the
// full ProductCategoryData shape so the editor doesn't crash on first render.
function normalize(raw: Record<string, unknown>): ProductCategoryData {
  const r = raw as Partial<ProductCategoryData>;
  return {
    altTitle: typeof r.altTitle === "string" ? r.altTitle : "",
    mainImage: r.mainImage ?? null,
    altImage: r.altImage ?? null,
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

// ─── Single-image picker ─────────────────────────────────────────────────────

function ImageField({
  label,
  modalTitle,
  value,
  onChange,
}: {
  label: string;
  modalTitle: string;
  value: GalleryImage | null;
  onChange: (v: GalleryImage | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Stack gap={6}>
        <Text size="sm" fw={500}>{label}</Text>
        {value ? (
          <Group align="flex-start" gap={12}>
            <Image
              src={value.cdnUrl}
              w={120}
              h={120}
              fit="cover"
              radius="sm"
              alt={label}
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
            Odaberi sliku
          </Button>
        )}
      </Stack>
      <ImagePickerModal
        opened={open}
        onClose={() => setOpen(false)}
        title={modalTitle}
        mode="single"
        onConfirm={(imgs) => {
          if (imgs[0]) onChange(imgs[0]);
          setOpen(false);
        }}
      />
    </>
  );
}

// ─── Block editor (top-level) ────────────────────────────────────────────────

function ProductCategoryEditor({ data, onChange }: BlockEditorProps) {
  const d = useMemo(() => normalize(data), [data]);

  function patch(p: Partial<ProductCategoryData>) {
    onChange({ ...d, ...p } as unknown as Record<string, unknown>);
  }

  return (
    <Stack gap={20}>
      <Stack gap={10}>
        <SectionHeader title="Osnovni podaci" />
        <TextInput
          label="Alternativni naslov"
          placeholder="Alternativni naslov (opcionalno)"
          value={d.altTitle}
          onChange={(e) => patch({ altTitle: e.currentTarget.value })}
        />
        <ImageField
          label="Glavna slika"
          modalTitle="Odaberi glavnu sliku"
          value={d.mainImage}
          onChange={(v) => patch({ mainImage: v })}
        />
        <ImageField
          label="Alternativna slika"
          modalTitle="Odaberi alternativnu sliku"
          value={d.altImage}
          onChange={(v) => patch({ altImage: v })}
        />
      </Stack>
    </Stack>
  );
}

export const productCategoryBlock: BlockTypeDefinition = {
  type: "product-category",
  label: "Product category",
  defaultData: DEFAULT_DATA as unknown as Record<string, unknown>,
  EditorComponent: ProductCategoryEditor,
  getLabel: (data) => {
    const d = normalize(data);
    return d.altTitle?.trim() || "Product category";
  },
};
