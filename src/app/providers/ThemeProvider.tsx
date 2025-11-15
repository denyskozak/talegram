import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ThemeParams } from "@telegram-apps/types";

import { useTMA } from "./TMAProvider";
import { getSystemTheme } from "@/shared/lib";

export type ThemeColors = {
  background: string;
  text: string;
  subtitle: string;
  hint: string;
  accent: string;
  section: string;
  separator: string;
};

const defaultColors: ThemeColors = {
  background: "#ffffff",
  text: "#0f0f0f",
  subtitle: "#7f7f81",
  hint: "#7f7f81",
  accent: "#3390ff",
  section: "#f3f3f5",
  separator: "#d3d3d7",
};

type ThemeMode = "light" | "dark";

type ThemeModeContextValue = {
  mode: ThemeMode;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeColors>(defaultColors);
const ThemeModeContext = createContext<ThemeModeContextValue>({ mode: "light", toggle: () => {} });

const darkColors: ThemeColors = {
  background: "#0f1014",
  text: "#f7f8fa",
  subtitle: "#a8abb4",
  hint: "#818593",
  accent: "#6ab7ff",
  section: "#171a21",
  separator: "#2a2e37",
};

function mapTheme(theme?: ThemeParams | null): ThemeColors {
  if (!theme) {
    return defaultColors;
  }

  return {
    background: theme.bg_color ?? defaultColors.background,
    text: theme.text_color ?? defaultColors.text,
    subtitle: theme.subtitle_text_color ?? theme.hint_color ?? defaultColors.subtitle,
    hint: theme.hint_color ?? defaultColors.hint,
    accent: theme.button_color ?? defaultColors.accent,
    section: theme.secondary_bg_color ?? defaultColors.section,
    separator: theme.section_separator_color ?? defaultColors.separator,
  };
}

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  const { theme } = useTMA();
  const systemColors = useMemo(() => mapTheme(theme), [theme]);
  const [mode, setMode] = useState<ThemeMode>(() => (getSystemTheme() === "dark" ? "dark" : "light"));
  const colors = useMemo(() => {
    if (mode === "dark") {
      return { ...darkColors, ...systemColors };
    }

    return systemColors;
  }, [mode, systemColors]);
  const toggle = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-bg-color", colors.background);
    root.style.setProperty("--app-text-color", colors.text);
    root.style.setProperty("--app-subtitle-color", colors.subtitle);
    root.style.setProperty("--app-hint-color", colors.hint);
    root.style.setProperty("--app-accent-color", colors.accent);
    root.style.setProperty("--app-section-color", colors.section);
    root.style.setProperty("--app-separator-color", colors.separator);
  }, [colors]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
      <ThemeContext.Provider value={colors}>
        <div
          style={{
            background: colors.background,
            color: colors.text,
            minHeight: "100vh",
            transition: "background 0.3s ease, color 0.3s ease",
          }}
        >
          {children}
        </div>
      </ThemeContext.Provider>
    </ThemeModeContext.Provider>
  );
}

export function useTheme(): ThemeColors {
  return useContext(ThemeContext);
}

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
