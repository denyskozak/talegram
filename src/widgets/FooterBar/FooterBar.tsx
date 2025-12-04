import { Text } from "@telegram-apps/telegram-ui";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

import { useTheme } from "@/app/providers/ThemeProvider";

type NavItem = {
  icon: JSX.Element;
  label: string;
  path: string;
};

function BooksIcon({ active }: { active: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.75 5.5c1.2-.5 3.2-.5 4.4 0 1.2.5 3.2.5 4.4 0 1.2-.5 3.2-.5 4.4 0v12.75c-1.2-.5-3.2-.5-4.4 0-1.2.5-3.2.5-4.4 0-1.2-.5-3.2-.5-4.4 0V5.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={active ? 2 : 1.5}
      />
      <path
        d="M6.75 5.5c1.2-.5 3.2-.5 4.4 0v12.75c-1.2-.5-3.2-.5-4.4 0"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={active ? 2 : 1.5}
      />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="8.5"
        r="3.25"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.5}
      />
      <path
        d="M6.25 18c1.25-2.1 3.4-3.25 5.75-3.25s4.5 1.15 5.75 3.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={active ? 2 : 1.5}
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.5}
      />
      <path
        d="M4.25 12c0-.58.08-1.14.23-1.67l-1.98-1.5 2-3.46 2.35.65c.68-.58 1.47-1.03 2.32-1.32l.28-2.38h4.2l.29 2.38c.84.29 1.63.74 2.31 1.32l2.35-.65 2 3.46-1.98 1.5c.15.53.23 1.09.23 1.67 0 .58-.08 1.14-.23 1.67l1.98 1.5-2 3.46-2.35-.65c-.68.58-1.47 1.03-2.31 1.32l-.29 2.38h-4.2l-.28-2.38a6.6 6.6 0 0 1-2.32-1.32l-2.35.65-2-3.46 1.98-1.5A6.7 6.7 0 0 1 4.25 12Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth={active ? 2 : 1.5}
      />
    </svg>
  );
}

function FooterNavItem({ item, isActive }: { item: NavItem; isActive: boolean }): JSX.Element {
  const theme = useTheme();

  return (
    <Link
      to={item.path}
      style={{
        textDecoration: "none",
        color: isActive ? theme.accent : theme.subtitle,
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
          {item.icon}
        </div>
        <Text weight={isActive ? "2" : "1"} style={{ fontSize: 12 }}>
          {item.label}
        </Text>
      </div>
    </Link>
  );
}

export function FooterBar(): JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const location = useLocation();

  const isActive = useCallback(
    (path: string) => (path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)),
    [location.pathname],
  );

  const navItems: NavItem[] = useMemo(
    () => [
      {
        icon: <AccountIcon active={isActive("/account")} />,
        label: t("navigation.account"),
        path: "/account",
      },
      {
        icon: <BooksIcon active={isActive("/")} />,
        label: t("navigation.books"),
        path: "/",
      },
      {
        icon: <SettingsIcon active={isActive("/settings")} />,
        label: t("navigation.settings"),
        path: "/settings",
      },
    ],
    [isActive, t],
  );

  return (
    <footer
      style={{
        borderTop: `1px solid ${theme.separator}`,
        background: theme.background,
        position: "sticky",
        bottom: 0,
        width: "100%",
        zIndex: 10,
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
