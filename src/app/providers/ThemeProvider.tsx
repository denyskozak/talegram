import { useMemo } from "react";

import type { ThemeParams } from "@telegram-apps/types";

import { useTMA } from "./TMAProvider";

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

export function useTheme(): ThemeColors {
  const { theme } = useTMA();

  return useMemo(() => mapTheme(theme), [theme]);
}
