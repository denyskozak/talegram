import { Card, Text, Title, Button } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/app/providers/ThemeProvider";

export default function ContactPage(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: 720,
        padding: "32px 16px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title level="1" weight="2">
          {t("contact.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("contact.subtitle")}</Text>
      </header>

      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <Text style={{ color: theme.text }}>{t("contact.description")}</Text>
        <Button
          type="button"
          mode="outline"
          size="s"
          onClick={() => {
            window.open("https://t.me/lawyerdsupport", "_blank", "noopener,noreferrer");
          }}
        >
          {t("contact.telegramCta")}
        </Button>
      </Card>
    </main>
  );
}
