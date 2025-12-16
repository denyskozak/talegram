import { Text } from "@telegram-apps/telegram-ui";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { useTheme } from "@/app/providers/ThemeProvider";

type NavItem = {
  iconSrc: string;
  label: string;
  path: string;
};

function FooterNavItem({ item, isActive }: { item: NavItem; isActive: boolean }): JSX.Element {
  const theme = useTheme();

  return (
    <Link
      to={item.path}
      style={{
        textDecoration: "none",
        color: isActive ? theme.text : theme.subtitle,
        flex: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "10px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isActive ? theme.accent : theme.text,
          }}
        >
          <img alt={item.label} height={36} src={item.iconSrc} width={36} />
        </div>
        <Text weight={isActive ? "2" : "1"} style={{ fontSize: 12 }}>
          {item.label}
        </Text>
      </div>
    </Link>
  );
}

export function FooterBar(): JSX.Element {
  const themeSetting = useTheme();
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = useCallback(
    (path: string) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)),
    [location.pathname],
  );

  const isDefaultThemeDark = themeSetting.text === "#ffffff" || themeSetting.text === "#FFFFFF";
  const iconMode = isDefaultThemeDark ? "dark" : "light";

  const navItems: NavItem[] = useMemo(
    () => [
      {
        iconSrc: `/icons/my_account_${iconMode}_mode_1.svg`,
        label: t("navigation.account"),
        path: "/account",
      },
      {
        iconSrc: `/icons/books_${iconMode}_mode_1.svg`,
        label: t("navigation.books"),
        path: "/",
      },
      {
        iconSrc: `/icons/settings_${iconMode}_mode_1.svg`,
        label: t("navigation.settings"),
        path: "/settings",
      },
    ],
    [iconMode, t],
  );

  return (
    <footer
      style={{
        borderTop: `1px solid ${themeSetting.separator}`,
        background: themeSetting.background,
        position: "sticky",
        bottom: 0,
        width: "100%",
        zIndex: 2,
      }}
    >
      <nav
        aria-label={t("navigation.label")}
        style={{
          margin: "0 auto",
          maxWidth: 720,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {navItems.map((item) => (
          <FooterNavItem isActive={isActive(item.path)} item={item} key={item.path} />
        ))}
      </nav>
    </footer>
  );
}
