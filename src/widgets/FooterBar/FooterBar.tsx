import { Text } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useTheme, useThemeMode } from "@/app/providers/ThemeProvider";
import { LanguageToggle } from "@/shared/ui/LanguageToggle";

export function FooterBar(): JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const { mode, toggle } = useThemeMode();
  const nextMode = mode === "dark" ? "light" : "dark";
  const themeIcon = nextMode === "dark" ? "🌙" : "☀️";

  return (
    <footer
      style={{
        borderTop: `1px solid ${theme.separator}`,
        background: theme.background,
      }}
    >
      <div
        style={{
          margin: "0 auto",
          maxWidth: 720,
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Text weight="2" style={{ color: theme.subtitle }}>
            {t("footer.languageLabel")}
          </Text>
          <LanguageToggle />
          <button
            type="button"
            onClick={toggle}
            aria-label={t("footer.themeToggleLabel", {
              mode: nextMode === "dark" ? t("footer.theme.dark") : t("footer.theme.light"),
            })}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: `1px solid ${theme.separator}`,
              background: theme.section,
              color: theme.text,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "background 0.3s ease, color 0.3s ease",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 18 }}>
              {themeIcon}
            </span>
          </button>
        </div>
        <Link
          to="/contact"
          style={{
            color: theme.accent,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("footer.contact")}
        </Link>
      </div>
    </footer>
  );
}
