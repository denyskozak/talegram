import { Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { LanguageToggle } from "@/shared/ui/LanguageToggle";
import { useTheme } from "@/app/providers/ThemeProvider";
import { Button } from "@/shared/ui/Button";

export default function SettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const supportLink = "https://t.me/lawyerdsupport";

  const sectionStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: "12px",
    borderRadius: 12,
    background: theme.section,
    border: `1px solid ${theme.separator}`,
  };

  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        color: theme.text,
      }}
    >
      <Title level="1">{t("settings.title")}</Title>
      <div style={sectionStyle}>
        <Text weight="2" style={{ color: theme.subtitle }}>
          {t("settings.language")}
        </Text>
        <LanguageToggle />
        <Text style={{ color: theme.subtitle }}>{t("settings.languageNote")}</Text>
      </div>
      <div style={{ ...sectionStyle, gap: 12 }}>
        <Text weight="2" style={{ color: theme.subtitle }}>
          {t("settings.contact.title")}
        </Text>
        <Text style={{ color: theme.subtitle }}>
          {t("settings.contact.description")}
        </Text>
        <Button type="button" size="s" mode="outline" onClick={() => window.open(supportLink, "_blank")}>
          {t("settings.contact.button")}
        </Button>
      </div>
      <div style={{ ...sectionStyle, gap: 10 }}>
        <Text weight="2" style={{ color: theme.subtitle }}>
          {t("settings.about.title")}
        </Text>
        <Text style={{ color: theme.subtitle }}>
          {t("settings.about.description")}
        </Text>
      </div>
      <Text style={{ color: theme.subtitle }}>{t("settings.description")}</Text>
    </div>
  );
}
