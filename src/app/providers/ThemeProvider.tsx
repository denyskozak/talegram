import {useMemo} from "react";

import type {ThemeParamsState} from "@tma.js/sdk";

import {useTMA} from "./TMAProvider";

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

function mapTheme(theme?: ThemeParamsState | null): ThemeColors {
    if (!theme) {
        return defaultColors;
    }

    return {
        background: theme.bg_color!,
        text: theme.text_color!,
        subtitle: theme.subtitle_text_color!,
        hint: theme.hint_color!,
        accent: theme.button_color!,
        section: theme.secondary_bg_color!,
        separator: theme.section_separator_color!,
    };
}

export function useTheme(): ThemeColors {
    const {theme} = useTMA();
    console.log("theme: ", theme?.bg_color);
    return useMemo(() => mapTheme(theme), [theme]);
}
