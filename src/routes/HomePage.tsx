import { useEffect, useState } from "react";
import { Title, Text, Anchor, List, Loader, Stack } from "@mantine/core";
import { Link, useParams } from "react-router";
import { getPages, type Page } from "@/lib/api";
import { usePageAlternates, useStrings } from "@/lib/locale";

export function HomePage() {
  const { locale } = useParams<{ locale: string }>();
  const activeLocale = locale ?? "hr";
  const { setAlternates } = usePageAlternates();
  const { t } = useStrings();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);

  // HomePage is locale-aware but has no per-page alternates payload — clear it.
  useEffect(() => {
    setAlternates(null);
  }, [setAlternates, activeLocale]);

  useEffect(() => {
    setLoading(true);
    getPages({ locale: activeLocale })
      .then(setPages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeLocale]);

  if (loading) return <Loader />;

  // Only show root-level pages on the home page; deeper pages still resolve
  // via direct slug URLs.
  const rootPages = pages.filter((p) => !p.parentId);

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={1}>{t("home.heading")}</Title>
        {t("home.intro") !== "home.intro" && (
          <Text c="dimmed">{t("home.intro")}</Text>
        )}
      </Stack>

      {rootPages.length > 0 ? (
        <Stack gap="xs">
          <Title order={3}>{t("home.all_pages_heading")}</Title>
          <List spacing="xs">
            {rootPages.map((page) => (
              <List.Item key={page.id}>
                <Anchor component={Link} to={`/${activeLocale}/${page.slug}`}>
                  {page.title}
                </Anchor>
              </List.Item>
            ))}
          </List>
        </Stack>
      ) : (
        <Text c="dimmed">{t("home.empty_state")}</Text>
      )}
    </Stack>
  );
}
