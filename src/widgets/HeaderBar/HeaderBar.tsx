import { useLocation, useNavigate } from "react-router-dom";

import { Button, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/app/providers/ThemeProvider";

export function HeaderBar(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { t } = useTranslation();

  const isAccountActive = location.pathname.startsWith("/account");

  const handleAccountClick = () => {
    if (!isAccountActive) {
      navigate("/account");
    }
  };

  return (
    <header
      style={{
        // position: "absolute",
        // top: 0,
        zIndex: 9,
        background: theme.background,
        borderBottom: `1px solid ${theme.separator}`,
      }}
    >
      <div
        style={{
          margin: "0 auto",
          maxWidth: 720,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label={t("app.name")}
            style={{
              display: "inline-flex",
              padding: 0,
              margin: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            <img
              src="/logo-v-1.webp"
              alt={t("app.name")}
              style={{ width: 32, height: 32, borderRadius: 8 }}
            />
          </button>
          <Title level="2" weight="2" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
            {t("app.name")}
          </Title>
        </div>
        <Button
          size="s"
          mode={isAccountActive ? "filled" : "outline"}
          onClick={handleAccountClick}
        >
          {t("header.account.button")}
        </Button>
      </div>
    </header>
  );
}
