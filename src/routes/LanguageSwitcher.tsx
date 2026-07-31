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
    // Use the full ancestor chain when the API provides it. Navigating to the
    // bare slug 404s for every nested page (e.g. /en/gift-programme instead of
    // /en/news/gift-programme); `path` falls back to `slug` for older APIs and
    // root-level pages, where they are the same thing.
    const segs = target?.path?.length ? target.path : target?.slug ? [target.slug] : [];
    if (target?.active && segs.length) {
      navigate(`/${to}/${segs.join("/")}`);
    } else {
      navigate(`/${to}/`);
    }
  };

  return (
    <Menu shadow="md" width={160} position="bottom-end" withArrow>
      <Menu.Target>
        <UnstyledButton aria-label="Change language" className="ln-lang-btn">
          <Group gap={6} wrap="nowrap">
            <GlobeIcon size={14} />
            <Text component="span" size="xs" fw={700} tt="uppercase">
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
