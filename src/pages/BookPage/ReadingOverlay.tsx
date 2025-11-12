import { useEffect, useMemo, useState } from "react";
import { Button, SegmentedControl, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import type { Book } from "@/entities/book/types";
import { themePalette } from "@/shared/config";
import { getSystemTheme, ReaderTheme } from "@/shared/lib";

type ReadingOverlayProps = {
  book: Book;
  onClose: () => void;
  preview?: boolean;
};

export function ReadingOverlay({ book, onClose, preview = false }: ReadingOverlayProps): JSX.Element {
  const { t } = useTranslation();
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState<ReaderTheme>(() => getSystemTheme());
  const palette = themePalette[theme];

  const showPreviewContent = preview || !book.bookFileURL;

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
              borderBottom: `1px solid ${palette.border}`,
            }}
          >
            <div style={{ width: "70%", margin: "0 auto" }}>
              <SegmentedControl>
                {(["light", "sepia", "dark"] as ReaderTheme[]).map((value) => (
                  <SegmentedControl.Item
                    key={value}
                    selected={value === theme}
                    onClick={() => setTheme(value)}
                  >
                    {t(`book.reader.theme.${value}` as const)}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, opacity: 0.7 }}>{t("book.reader.fontLabel")}</span>
              <Button
                size="s"
                mode="outline"
                onClick={decreaseFont}
                disabled={fontSize <= 14}
                aria-label={t("book.reader.fontDecrease")}
              >
                <span style={{ color: themePalette[theme].color }}>A-</span>
              </Button>
              <Button
                size="s"
                mode="outline"
                onClick={increaseFont}
                disabled={fontSize >= 26}
                aria-label={t("book.reader.fontIncrease")}
              >
                <span style={{ color: themePalette[theme].color }}>A+</span>
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
          style={{
            flex: 1,
            padding: "20px",
            display: "flex",
            backgroundColor: palette.background,
          }}
        >
          <embed
            src={book.bookFileURL ?? undefined}
            type={book.mimeType ?? "application/octet-stream"}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 12,
              backgroundColor: "#fff",
            }}
          />
        </div>
      )}
    </div>
  );
}
