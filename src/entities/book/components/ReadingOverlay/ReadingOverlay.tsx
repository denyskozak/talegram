import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import type { Book } from "@/entities/book/types";
import { useTMA } from "@/app/providers/TMAProvider";
import type { ThemeParams } from "@telegram-apps/sdk";

import { SpecialZoomLevel, Viewer, Worker } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
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

export function ReadingOverlay({ book, onClose, preview = false }: ReadingOverlayProps): JSX.Element {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState(18);
  const { theme } = useTMA();
  const palette = useMemo(() => getViewerPalette(theme), [theme]);
  const defaultLayoutPluginInstance = useMemo(() => defaultLayoutPlugin(), []);

  const showPreviewContent = preview || !book.bookFileURL;

  const viewerThemeStyles = useMemo<CSSProperties>(
    () => ({
      "--reader-page-background": palette.page.background,
      "--reader-page-border": palette.page.border,
      "--reader-page-shadow": palette.page.shadow,
      "--reader-page-filter": palette.page.filter ?? "none",
    }),
    [palette],
  );

  const luminance = useMemo(() => getLuminance(theme?.bg_color), [theme]);
  const isDarkTheme = luminance !== null ? luminance < 0.35 : false;

  const paragraphs = useMemo(() => {
    const author = book.authors[0] ?? t("book.reader.unknownAuthor");
    const focus = book.tags[0]
      ? t("book.reader.sampleFocusTag", { tag: book.tags[0] })
      : t("book.reader.sampleFocusFallback");

    return [
      t("book.reader.sampleIntro", { title: book.title, author }),
      book.description,
      t("book.reader.sampleMiddle", { focus }),
      t("book.reader.sampleOutro"),
    ];
  }, [book.authors, book.description, book.tags, book.title, t]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const decreaseFont = () => {
    setFontSize((current) => Math.max(14, current - 2));
  };

  const increaseFont = () => {
    setFontSize((current) => Math.min(26, current + 2));
  };

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
      <header
        style={{
          padding: "20px 20px 12px",
          display: "flex",
          flexWrap: "wrap",
          marginTop: "70px",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${palette.border}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}>
          <Title level="2" weight="2" style={{ margin: 0, color: "inherit" }}>
            {book.title}
          </Title>
          <span style={{ fontSize: 16, opacity: 0.7 }}>{book.authors.join(", ")}</span>
        </div>
        <Button
          size="s"
          mode="outline"
          onClick={onClose}
          aria-label={t("book.reader.close")}
          style={{ whiteSpace: "nowrap" }}
        >
          {t("book.reader.close")}
        </Button>
      </header>
      {showPreviewContent ? (
        <>
          <div
            style={{
              padding: "12px 20px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${palette.border}`,
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{t("book.reader.fontLabel")}</span>
              <Button
                size="s"
                mode="outline"
                onClick={decreaseFont}
                disabled={fontSize <= 14}
                aria-label={t("book.reader.fontDecrease")}
              >
                <span style={{ color: palette.color }}>A-</span>
              </Button>
              <Button
                size="s"
                mode="outline"
                onClick={increaseFont}
                disabled={fontSize >= 26}
                aria-label={t("book.reader.fontIncrease")}
              >
                <span style={{ color: palette.color }}>A+</span>
              </Button>
            </div>

            <span style={{ fontSize: 12, opacity: 0.6 }}>{t("book.reader.demoNotice")}</span>
          </div>
          <div
            style={{
              flex: 1,
              padding: "20px 20px 32px",
              fontSize,
              lineHeight: 1.7,
              overflowY: "auto",
              scrollbarWidth: "thin",
            }}
          >
            {paragraphs.map((paragraph, index) => (
              <p key={index} style={{ margin: 0, marginBottom: 20 }}>
                {paragraph}
              </p>
            ))}
          </div>
        </>
      ) : (
        <div
          className="reading-overlay__viewer"
          style={{
            flex: 1,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            backgroundColor: palette.background,
            overflow: "hidden",
            ...viewerThemeStyles,
          }}
        >
          <Worker workerUrl={pdfWorkerSrc}>
            <Viewer
              fileUrl={book.bookFileURL ?? ""}
              plugins={[defaultLayoutPluginInstance]}
              theme={isDarkTheme ? "dark" : "light"}
              defaultScale={SpecialZoomLevel.PageFit}
              renderLoader={renderViewerLoader}
              renderError={renderViewerError}
            />
          </Worker>
        </div>
      )}
    </div>
  );
}
