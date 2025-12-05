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

function BooksIcon(): JSX.Element {
  return (
      <svg
          height="32px"
          width="32px"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 64 64"
          xmlSpace="preserve"
      >
          <style type="text/css">
              {
                  "\n\t.st4{fill:#C75C5C;}\n\t.st5{fill:#E0E0D1;}\n\t.st6{fill:#FFFFFF;}\n\t.st7{fill:#4F5D73;}\n\t.st8{fill:#31a6ed;}\n"
              }
          </style>
          <g id="Layer_1">
              <g>
                  <circle className="st0" cx={31.8} cy={32} r={32} />
              </g>
              <g className="st1">
                  <path
                      className="st2"
                      d="M52,48c0,1.1-0.9,2-2,2H14c-1.1,0-2-0.9-2-2l0,0c0-1.1,0.9-2,2-2h36C51.1,46,52,46.9,52,48L52,48z"
                  />
              </g>
              <g>
                  <path
                      className="st3"
                      d="M52,46c0,1.1-0.9,2-2,2H14c-1.1,0-2-0.9-2-2l0,0c0-1.1,0.9-2,2-2h36C51.1,44,52,44.9,52,46L52,46z"
                  />
              </g>
              <g>
                  <path
                      className="st4"
                      d="M23,20h-4c-1.7,0-3,1.3-3,3v17v1v3h3h4h3v-3v-1V23C26,21.3,24.7,20,23,20z"
                  />
              </g>
              <g>
                  <path
                      className="st5"
                      d="M45,16h-4c-1.7,0-3,1.3-3,3v21v1v3h3h4h3v-3v-1V19C48,17.3,46.7,16,45,16z"
                  />
              </g>
              <g>
                  <rect x={16} y={24} className="st3" width={10} height={3} />
              </g>
              <g>
                  <rect x={16} y={37} className="st3" width={10} height={3} />
              </g>
              <g>
                  <rect x={38} y={37} className="st6" width={10} height={3} />
              </g>
              <g>
                  <rect x={38} y={20} className="st6" width={10} height={3} />
              </g>
              <g>
                  <g className="st1">
                      <path
                          className="st2"
                          d="M40,40V16.2c-1.2,0.4-2,1.5-2,2.8v21v1v3h2v-3V40z"
                      />
                  </g>
                  <g className="st1">
                      <path
                          className="st2"
                          d="M26,40V23c0-1.3-0.8-2.4-2-2.8V40v1v3h2v-3V40z"
                      />
                  </g>
              </g>
              <g>
                  <path
                      className="st7"
                      d="M35,12h-6c-1.7,0-3,1.3-3,3v25v1v3h3h6h3v-3v-1V15C38,13.3,36.7,12,35,12z"
                  />
              </g>
              <g>
                  <rect x={26} y={16} className="st8" width={12} height={3} />
              </g>
              <g>
                  <rect x={26} y={37} className="st8" width={12} height={3} />
              </g>
          </g>
          <g id="Layer_2" />
      </svg>
  );
}

function AccountIcon(): JSX.Element {
  return (
      <svg
          height="32px"
          width="32px"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 64 64"
          xmlSpace="preserve"
      >

          <g id="Layer_1">
              <g>
                  <circle className="st0" cx={32} cy={32} r={32} />
              </g>
              <g className="st4">
                  <g>
                      <path
                          className="st2"
                          d="M43.9,47.5c-3.8-1.7-5.2-4.2-5.6-6.5c2.8-2.2,4.9-5.8,6.1-9.6c1.2-1.6,2-3.2,2-4.6c0-1-0.3-1.6-1-2.2 c-0.2-8.1-5.9-14.6-13-14.7c-0.1,0-0.1,0-0.2,0c0,0,0,0-0.1,0c-7.1,0-12.8,6.4-13.1,14.4c-0.9,0.5-1.4,1.3-1.4,2.5 c0,1.6,1,3.6,2.7,5.4c1.2,3.3,3.1,6.4,5.5,8.4c-0.4,2.3-1.7,5-5.7,6.8c-2.2,0.9-6.1,1.8-7.8,2.6C16.6,55,24.9,58,31.9,58l0.1,0 c0,0,0,0,0,0c7,0,15.3-3,19.7-7.8C50,49.3,46.1,48.5,43.9,47.5z"
                      />
                  </g>
              </g>
              <g>
                  <g>
                      <path
                          className="st4"
                          d="M43.9,45.5c-3.8-1.7-5.2-4.2-5.6-6.5c2.8-2.2,4.9-5.8,6.1-9.6c1.2-1.6,2-3.2,2-4.6c0-1-0.3-1.6-1-2.2 c-0.2-8.1-5.9-14.6-13-14.7c-0.1,0-0.1,0-0.2,0c0,0,0,0-0.1,0C25.1,8,19.4,14.4,19,22.4c-0.9,0.5-1.4,1.3-1.4,2.5 c0,1.6,1,3.6,2.7,5.4c1.2,3.3,3.1,6.4,5.5,8.4c-0.4,2.3-1.7,5-5.7,6.8c-2.2,0.9-6.1,1.8-7.8,2.6C16.6,53,24.9,56,31.9,56l0.1,0 c0,0,0,0,0,0c7,0,15.3-3,19.7-7.8C50,47.3,46.1,46.5,43.9,45.5z"
                      />
                  </g>
              </g>
          </g>
          <g id="Layer_2" />
      </svg>
  );
}

function SettingsIcon(): JSX.Element {
  return (
      <svg
          height="32px"
          width="32px"
          xmlns="http://www.w3.org/2000/svg"
          xmlnsXlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 64 64"
          xmlSpace="preserve"
      >
          <style type="text/css">
              {
                  "\n\t.st0{fill:#31a6ed;}\n\t.st1{opacity:0.2;}\n\t.st2{fill:#231F20;}\n\t.st3{fill:#4F5D73;}\n\t.st4{fill:#FFFFFF;}\n"
              }
          </style>
          <g id="Layer_1">
              <g>
                  <circle className="st0" cx={32} cy={32} r={32} />
              </g>
              <g className="st1">
                  <g>
                      <path
                          className="st2"
                          d="M27.5,34c0,2.5,2,4.5,4.5,4.5s4.5-2,4.5-4.5s-2-4.5-4.5-4.5S27.5,31.5,27.5,34z"
                      />
                  </g>
              </g>
              <g className="st1">
                  <path
                      className="st2"
                      d="M53.9,32.6c0-0.5-0.5-1.1-1-1.3l-4.1-1.5c-0.5-0.2-1.1-0.8-1.3-1.3l-0.7-1.6c-0.2-0.5-0.2-1.3,0-1.8l1.9-3.9 c0.2-0.5,0.1-1.2-0.2-1.6l-2-2c-0.4-0.4-1.2-0.5-1.6-0.2l-3.9,1.9c-0.5,0.2-1.3,0.2-1.8,0l-1.6-0.7c-0.5-0.2-1.1-0.8-1.3-1.3 l-1.5-4.1c-0.2-0.5-0.8-1-1.3-1c0,0-0.6-0.1-1.4-0.1s-1.4,0.1-1.4,0.1c-0.5,0-1.1,0.5-1.3,1l-1.5,4.1c-0.2,0.5-0.8,1.1-1.3,1.3 l-1.6,0.7c-0.5,0.2-1.3,0.2-1.8,0l-3.9-1.9c-0.5-0.2-1.2-0.1-1.6,0.2l-2,2c-0.4,0.4-0.5,1.2-0.2,1.6l1.9,3.9 c0.2,0.5,0.2,1.3,0,1.8l-0.7,1.6c-0.2,0.5-0.8,1.1-1.3,1.3l-4.1,1.5c-0.5,0.2-1,0.8-1,1.3c0,0-0.1,0.6-0.1,1.4 c0,0.8,0.1,1.4,0.1,1.4c0,0.5,0.5,1.1,1,1.3l4.1,1.5c0.5,0.2,1.1,0.8,1.3,1.3l0.7,1.6c0.2,0.5,0.2,1.3,0,1.8l-1.9,3.9 c-0.2,0.5-0.1,1.2,0.2,1.6l2,2c0.4,0.4,1.2,0.5,1.6,0.2l3.9-1.9c0.5-0.2,1.3-0.2,1.8,0l1.6,0.7c0.5,0.2,1.1,0.8,1.3,1.3l1.5,4.1 c0.2,0.5,0.8,1,1.3,1c0,0,0.6,0.1,1.4,0.1s1.4-0.1,1.4-0.1c0.5,0,1.1-0.5,1.3-1l1.5-4.1c0.2-0.5,0.8-1.1,1.3-1.3l1.6-0.7 c0.5-0.2,1.3-0.2,1.8,0l3.9,1.9c0.5,0.2,1.2,0.1,1.6-0.2l2-2c0.4-0.4,0.5-1.2,0.2-1.6l-1.9-3.9c-0.2-0.5-0.2-1.3,0-1.8l0.7-1.6 c0.2-0.5,0.8-1.1,1.3-1.3l4.1-1.5c0.5-0.2,1-0.8,1-1.3c0,0,0.1-0.6,0.1-1.4C54,33.2,53.9,32.6,53.9,32.6z M32,44 c-5.5,0-10-4.5-10-10c0-5.5,4.5-10,10-10s10,4.5,10,10C42,39.5,37.5,44,32,44z"
                  />
              </g>
              <g>
                  <g>
                      <path
                          className="st3"
                          d="M27.5,32c0,2.5,2,4.5,4.5,4.5s4.5-2,4.5-4.5s-2-4.5-4.5-4.5S27.5,29.5,27.5,32z"
                      />
                  </g>
              </g>
              <g>
                  <path
                      className="st4"
                      d="M53.9,30.6c0-0.5-0.5-1.1-1-1.3l-4.1-1.5c-0.5-0.2-1.1-0.8-1.3-1.3l-0.7-1.6c-0.2-0.5-0.2-1.3,0-1.8l1.9-3.9 c0.2-0.5,0.1-1.2-0.2-1.6l-2-2c-0.4-0.4-1.2-0.5-1.6-0.2l-3.9,1.9c-0.5,0.2-1.3,0.2-1.8,0l-1.6-0.7c-0.5-0.2-1.1-0.8-1.3-1.3 l-1.5-4.1c-0.2-0.5-0.8-1-1.3-1c0,0-0.6-0.1-1.4-0.1s-1.4,0.1-1.4,0.1c-0.5,0-1.1,0.5-1.3,1l-1.5,4.1c-0.2,0.5-0.8,1.1-1.3,1.3 l-1.6,0.7c-0.5,0.2-1.3,0.2-1.8,0l-3.9-1.9c-0.5-0.2-1.2-0.1-1.6,0.2l-2,2c-0.4,0.4-0.5,1.2-0.2,1.6l1.9,3.9 c0.2,0.5,0.2,1.3,0,1.8l-0.7,1.6c-0.2,0.5-0.8,1.1-1.3,1.3l-4.1,1.5c-0.5,0.2-1,0.8-1,1.3c0,0-0.1,0.6-0.1,1.4 c0,0.8,0.1,1.4,0.1,1.4c0,0.5,0.5,1.1,1,1.3l4.1,1.5c0.5,0.2,1.1,0.8,1.3,1.3l0.7,1.6c0.2,0.5,0.2,1.3,0,1.8l-1.9,3.9 c-0.2,0.5-0.1,1.2,0.2,1.6l2,2c0.4,0.4,1.2,0.5,1.6,0.2l3.9-1.9c0.5-0.2,1.3-0.2,1.8,0l1.6,0.7c0.5,0.2,1.1,0.8,1.3,1.3l1.5,4.1 c0.2,0.5,0.8,1,1.3,1c0,0,0.6,0.1,1.4,0.1s1.4-0.1,1.4-0.1c0.5,0,1.1-0.5,1.3-1l1.5-4.1c0.2-0.5,0.8-1.1,1.3-1.3l1.6-0.7 c0.5-0.2,1.3-0.2,1.8,0l3.9,1.9c0.5,0.2,1.2,0.1,1.6-0.2l2-2c0.4-0.4,0.5-1.2,0.2-1.6l-1.9-3.9c-0.2-0.5-0.2-1.3,0-1.8l0.7-1.6 c0.2-0.5,0.8-1.1,1.3-1.3l4.1-1.5c0.5-0.2,1-0.8,1-1.3c0,0,0.1-0.6,0.1-1.4C54,31.2,53.9,30.6,53.9,30.6z M32,42 c-5.5,0-10-4.5-10-10c0-5.5,4.5-10,10-10s10,4.5,10,10C42,37.5,37.5,42,32,42z"
                  />
              </g>
          </g>
          <g id="Layer_2" />
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
        icon: <AccountIcon />,
        label: t("navigation.account"),
        path: "/account",
      },
      {
        icon: <BooksIcon />,
        label: t("navigation.books"),
        path: "/",
      },
      {
        icon: <SettingsIcon />,
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
