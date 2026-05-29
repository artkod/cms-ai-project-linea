import { Title, Text, Button, Stack } from "@mantine/core";
import { Link, useParams } from "react-router";
import { useLocaleConfig } from "@/lib/locale";

export function NotFound() {
  const { locale } = useParams<{ locale?: string }>();
  const { defaultLocale } = useLocaleConfig();
  const home = `/${locale ?? defaultLocale}/`;
  return (
    <Stack align="center" justify="center" style={{ minHeight: 400, textAlign: "center" }}>
      <Text size="6rem" fw={900} c="teal" lh={1}>
        404
      </Text>
      <Title order={2}>Page not found</Title>
      <Text c="dimmed" maw={400}>
        The page you're looking for doesn't exist or may have been moved.
      </Text>
      <Button component={Link as any} to={home} variant="light" color="teal" mt="md">
        Back to homepage
      </Button>
    </Stack>
  );
}
