import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Image,
  NumberInput,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { type Page } from "@/lib/api";
import { useStrings, useLocaleConfig } from "@/lib/locale";

// Simple Mantine cart. There is no cart state / "add to cart" control wired
// yet (that lands with the navigation work later), so this view seeds a few
// placeholder line items purely so the layout is reviewable. Swap `INITIAL`
// for the real cart store once it exists; the empty-cart branch already
// renders when the list is cleared.
// NOTE: placeholder design — refine to match the example screen.

interface CartLine {
  id: string;
  title: string;
  image: string | null;
  unitPrice: number;
  qty: number;
}

const INITIAL: CartLine[] = [
  { id: "1", title: "Roll-up baner 85×200", image: null, unitPrice: 49.0, qty: 2 },
  { id: "2", title: "Reklamni stalak A1", image: null, unitPrice: 129.9, qty: 1 },
  { id: "3", title: "Promotivni pult", image: null, unitPrice: 219.0, qty: 1 },
];

const eurFmt = new Intl.NumberFormat("hr-HR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function CartView({ page }: { page: Page }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const { defaultLocale } = useLocaleConfig();
  const locale = localeParam ?? defaultLocale;
  const { t } = useStrings();

  const [lines, setLines] = useState<CartLine[]>(INITIAL);

  const home = `/${locale}/`;

  function setQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)));
  }

  function remove(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);

  // ── Empty cart ──
  if (lines.length === 0) {
    return (
      <Box>
        <Title order={1} mb="lg">{page.title}</Title>
        <Stack align="center" gap="sm" py={64} style={{ textAlign: "center" }}>
          <Box c="dimmed"><ShoppingCart size={56} strokeWidth={1.25} /></Box>
          <Title order={3}>{t("cart.empty_title")}</Title>
          <Text c="dimmed" maw={420}>{t("cart.empty_text")}</Text>
          <Button component={Link as any} to={home} variant="light" color="teal" mt="sm">
            {t("cart.continue_shopping")}
          </Button>
        </Stack>
      </Box>
    );
  }

  // ── Filled cart ──
  return (
    <Box>
      <Title order={1} mb="lg">{page.title}</Title>

      <Grid gutter="xl" align="flex-start">
        {/* Line items */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {lines.map((l) => (
              <Card key={l.id} withBorder padding="md" radius="md">
                <Group wrap="nowrap" align="flex-start" gap="md">
                  <Image
                    src={l.image ?? undefined}
                    w={88}
                    h={88}
                    radius="sm"
                    fit="cover"
                    fallbackSrc="https://placehold.co/200x200?text=%20"
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Text fw={600} lineClamp={2}>{l.title}</Text>
                        <Text size="sm" c="dimmed">
                          {t("cart.unit_price")}: {eurFmt.format(l.unitPrice)}
                        </Text>
                      </Stack>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={t("cart.remove")}
                        onClick={() => remove(l.id)}
                      >
                        <Trash2 size={18} />
                      </ActionIcon>
                    </Group>

                    <Group justify="space-between" align="center" mt="sm" wrap="nowrap">
                      <Group gap={4} align="center" wrap="nowrap">
                        <ActionIcon
                          variant="default"
                          aria-label="-"
                          onClick={() => setQty(l.id, l.qty - 1)}
                        >
                          <Minus size={14} />
                        </ActionIcon>
                        <NumberInput
                          value={l.qty}
                          onChange={(v) => setQty(l.id, Number(v) || 1)}
                          min={1}
                          hideControls
                          w={56}
                          styles={{ input: { textAlign: "center" } }}
                          aria-label={t("cart.quantity")}
                        />
                        <ActionIcon
                          variant="default"
                          aria-label="+"
                          onClick={() => setQty(l.id, l.qty + 1)}
                        >
                          <Plus size={14} />
                        </ActionIcon>
                      </Group>
                      <Text fw={700}>{eurFmt.format(l.unitPrice * l.qty)}</Text>
                    </Group>
                  </Box>
                </Group>
              </Card>
            ))}
          </Stack>
        </Grid.Col>

        {/* Order summary */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder padding="lg" radius="md">
            <Title order={4} mb="md">{t("cart.summary_title")}</Title>
            <Group justify="space-between" mb="xs">
              <Text c="dimmed">{t("cart.subtotal")}</Text>
              <Text fw={500}>{eurFmt.format(subtotal)}</Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text c="dimmed">{t("cart.shipping")}</Text>
              <Text c="dimmed" fz="sm">{t("cart.shipping_note")}</Text>
            </Group>
            <Divider my="sm" />
            <Group justify="space-between" mb="lg">
              <Text fw={700}>{t("cart.total")}</Text>
              <Text fw={700} fz="lg">{eurFmt.format(subtotal)}</Text>
            </Group>
            <Button fullWidth color="teal" size="md">{t("cart.checkout")}</Button>
            <Button
              component={Link as any}
              to={home}
              fullWidth
              variant="subtle"
              color="gray"
              mt="xs"
            >
              {t("cart.continue_shopping")}
            </Button>
            <Text size="xs" c="dimmed" ta="center" mt="sm">{t("cart.vat_note")}</Text>
          </Card>
        </Grid.Col>
      </Grid>
    </Box>
  );
}
