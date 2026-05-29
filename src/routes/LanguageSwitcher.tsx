import { Menu, UnstyledButton, Group, Text } from "@mantine/core";
import { useNavigate, useParams } from "react-router";
import { useLocaleConfig, isKnownLocale, usePageAlternates } from "@/lib/locale";

function GlobeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ChevronIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { availableLocales, defaultLocale } = useLocaleConfig();
  const { alternates } = usePageAlternates();
  const navigate = useNavigate();
  const params = useParams<{ locale?: string }>();
  const current = isKnownLocale(params.locale, availableLocales) ? params.locale! : defaultLocale;

  if (availableLocales.length <= 1) return null;

  const change = (to: string) => {
    if (to === current) return;
    const target = alternates?.[to];
    if (target?.active && target.slug) {
      navigate(`/${to}/${target.slug}`);
    } else {
      navigate(`/${to}/`);
    }
  };

  return (
    <Menu shadow="md" width={160} position="bottom-end" withArrow>
      <Menu.Target>
        <UnstyledButton
          aria-label="Change language"
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e9ecef",
            background: "#fff",
            fontSize: 13,
            fontWeight: 600,
            color: "#1f2a40",
          }}
        >
          <Group gap={6} wrap="nowrap">
            <GlobeIcon size={14} />
            <Text component="span" size="xs" fw={700} style={{ textTransform: "uppercase" }}>
              {current}
            </Text>
            <ChevronIcon size={12} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {availableLocales.map((loc) => (
          <Menu.Item
            key={loc}
            onClick={() => change(loc)}
            style={{ fontWeight: loc === current ? 700 : 500 }}
          >
            <Group justify="space-between">
              <Text size="sm" tt="uppercase">{loc}</Text>
              {alternates && !alternates[loc]?.active ? (
                <Text size="xs" c="dimmed">home</Text>
              ) : null}
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
