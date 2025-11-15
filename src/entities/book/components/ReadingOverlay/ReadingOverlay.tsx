import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Book } from "@/entities/book/types";
import { useTMA } from "@/app/providers/TMAProvider";
import type { ThemeParams } from "@telegram-apps/sdk";

import { SpecialZoomLevel, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { zoomPlugin } from "@react-pdf-viewer/zoom";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/zoom/lib/styles/index.css";
// import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "./ReadingOverlay.css";

type ViewerPalette = {
  background: string;
  color: string;
  border: string;
  page: {
    background: string;
    border: string;
    shadow: string;
    filter?: string;
  };
};

const LIGHT_VIEWER_PALETTE: ViewerPalette = {
  background: "#fdfdfd",
  color: "#1c1c1c",
  border: "rgba(15, 23, 42, 0.12)",
  page: {
    background: "#ffffff",
    border: "rgba(15, 23, 42, 0.08)",
    shadow: "rgba(15, 23, 42, 0.12)",
  },
};

const DARK_VIEWER_PALETTE: ViewerPalette = {
  background: "#121212",
  color: "#f1f5f9",
  border: "rgba(248, 250, 252, 0.16)",
  page: {
    background: "#1b2029",
    border: "rgba(148, 163, 184, 0.22)",
    shadow: "rgba(15, 23, 42, 0.55)",
    filter: "invert(0.92) hue-rotate(180deg)",
  },
};

function getLuminance(color?: string): number | null {
  if (!color) {
    return null;
  }

  const normalized = color.startsWith("#") ? color.slice(1) : color;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);

  const linearR = toLinear(r);
  const linearG = toLinear(g);
  const linearB = toLinear(b);

  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

function getViewerPalette(theme?: ThemeParams | null): ViewerPalette {
  const luminance = getLuminance(theme?.bg_color);
  const isDark = luminance !== null ? luminance < 0.35 : false;
  const base = isDark ? DARK_VIEWER_PALETTE : LIGHT_VIEWER_PALETTE;

  return {
    background: theme?.bg_color ?? base.background,
    color: theme?.text_color ?? base.color,
    border: theme?.section_separator_color ?? base.border,
    page: {
      background: theme?.secondary_bg_color ?? base.page.background,
      border: theme?.section_separator_color ?? base.page.border,
      shadow: base.page.shadow,
      filter: isDark ? base.page.filter : undefined,
    },
  };
}

type ReadingOverlayProps = {
  book: Book;
  onClose: () => void;
  preview?: boolean;
};

export function ReadingOverlay({ book }: ReadingOverlayProps): JSX.Element {
  const { t } = useTranslation();
  const { theme } = useTMA();
  const palette = useMemo(() => getViewerPalette(theme), [theme]);
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const zoomPluginInstance = zoomPlugin();

  const luminance = useMemo(() => getLuminance(theme?.bg_color), [theme]);
  const isDarkTheme = luminance !== null ? luminance < 0.35 : false;


  const renderViewerLoader = useCallback(
    () => (
      <div style={{ textAlign: "center", padding: "32px 16px", color: palette.color }}>
        {t("book.reader.loading")}
      </div>
    ),
    [palette.color, t],
  );

  const renderViewerError = useCallback(
    (error: unknown) => {
      console.error("Failed to render book file", error);
      return (
        <div style={{ textAlign: "center", padding: "32px 16px", color: palette.color }}>
          {t("book.reader.loadError")}
        </div>
      );
    },
    [palette.color, t],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("book.reader.title")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: palette.background,
        color: palette.color,
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/*<header*/}
      {/*  style={{*/}
      {/*    padding: "20px 20px 12px",*/}
      {/*    display: "flex",*/}
      {/*    flexWrap: "wrap",*/}
      {/*    marginTop: "70px",*/}
      {/*    gap: 12,*/}
      {/*    justifyContent: "space-between",*/}
      {/*    alignItems: "center",*/}
      {/*    borderBottom: `1px solid ${palette.border}`,*/}
      {/*  }}*/}
      {/*>*/}
      {/*  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>*/}
      {/*    <Title level="2" weight="2" style={{ margin: 0, color: "inherit" }}>*/}
      {/*      {book.title}*/}
      {/*    </Title>*/}
      {/*    <span style={{ fontSize: 16, opacity: 0.7 }}>{book.authors.join(", ")}</span>*/}
      {/*  </div>*/}
      {/*  <div*/}
      {/*    style={{*/}
      {/*      display: "flex",*/}
      {/*      alignItems: "center",*/}
      {/*      gap: 8,*/}
      {/*      flexWrap: "wrap",*/}
      {/*      justifyContent: "flex-end",*/}
      {/*    }}*/}
      {/*  >*/}
      {/*    <span style={{ fontSize: 14, opacity: 0.7 }}>{t("book.reader.fontLabel")}</span>*/}
      {/*    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>*/}
      {/*      <ZoomOutButton />*/}
      {/*      <ZoomPopover />*/}
      {/*      <ZoomInButton />*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*  <Button*/}
      {/*    size="s"*/}
      {/*    mode="outline"*/}
      {/*    onClick={onClose}*/}
      {/*    aria-label={t("book.reader.close")}*/}
      {/*    style={{ whiteSpace: "nowrap" }}*/}
      {/*  >*/}
      {/*    {t("book.reader.close")}*/}
      {/*  </Button>*/}
      {/*</header>*/}
        <Viewer
            fileUrl={book.bookFileURL ?? ""}
            plugins={[defaultLayoutPluginInstance, zoomPluginInstance]}
            theme={isDarkTheme ? "dark" : "light"}
            defaultScale={SpecialZoomLevel.PageFit}
            renderLoader={renderViewerLoader}
            renderError={renderViewerError}
        />
    </div>
  );
}
