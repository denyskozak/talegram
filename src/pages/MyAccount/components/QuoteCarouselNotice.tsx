import { useEffect, useMemo, useState } from "react";
import { Text } from "@telegram-apps/telegram-ui";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

type Quote = {
  english: string;
  russian: string;
};

type QuoteSection = {
  title: string;
  quotes: Quote[];
};

type QuoteCarouselNoticeProps = {
  theme: ThemeColors;
  t: TFunction<"translation">;
};

const DISPLAY_DURATION_MS = 6000;
const FADE_DURATION_MS = 600;

export function QuoteCarouselNotice({
  theme,
  t,
}: QuoteCarouselNoticeProps): JSX.Element | null {
  const sections = useMemo(() => {
    const translatedSections = t("account.publish.form.quoteCarousel.sections", {
      returnObjects: true,
    });

    if (!Array.isArray(translatedSections)) {
      return [] as QuoteSection[];
    }

    return translatedSections as QuoteSection[];
  }, [t]);

  const labels = useMemo(() => {
    const translatedLabels = t("account.publish.form.quoteCarousel.labels", {
      returnObjects: true,
    });

    if (
      typeof translatedLabels === "object" &&
      translatedLabels !== null &&
      "english" in translatedLabels &&
      "russian" in translatedLabels
    ) {
      return translatedLabels as { english: string; russian: string };
    }

    return { english: "English", russian: "Русский" };
  }, [t]);

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setCurrentSectionIndex(0);
    setCurrentQuoteIndex(0);
    setIsVisible(true);
  }, [sections]);

  useEffect(() => {
    if (sections.length === 0) {
      return undefined;
    }

    const fadeTimeout = setTimeout(() => {
      setIsVisible(false);
    }, Math.max(0, DISPLAY_DURATION_MS - FADE_DURATION_MS));

    const switchTimeout = setTimeout(() => {
      const currentSection = sections[currentSectionIndex];

      if (!currentSection) {
        setIsVisible(true);
        return;
      }

      const nextQuoteIndex = currentQuoteIndex + 1;

      if (nextQuoteIndex < currentSection.quotes.length) {
        setCurrentQuoteIndex(nextQuoteIndex);
      } else {
        setCurrentSectionIndex((currentSectionIndex + 1) % sections.length);
        setCurrentQuoteIndex(0);
      }

      setIsVisible(true);
    }, DISPLAY_DURATION_MS);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(switchTimeout);
    };
  }, [currentQuoteIndex, currentSectionIndex, sections]);

  const currentSection = sections[currentSectionIndex];
  const currentQuote = currentSection?.quotes[currentQuoteIndex];

  if (!currentSection || !currentQuote) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      style={{
        borderRadius: 12,
        border: `1px solid ${theme.separator}`,
        background: theme.section,
        padding: "16px 18px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          opacity: isVisible ? 1 : 0,
          transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
        }}
      >
        <Text weight="2" style={{ color: theme.text }}>
          {currentSection.title}
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Text style={{ color: theme.text }}>
            <span style={{ color: theme.subtitle }}>{labels.english}:</span> {currentQuote.english}
          </Text>
          <Text style={{ color: theme.text }}>
            <span style={{ color: theme.subtitle }}>{labels.russian}:</span> {currentQuote.russian}
          </Text>
        </div>
        <Text style={{ color: theme.subtitle, fontSize: 12 }}>
          {currentQuoteIndex + 1} / {currentSection.quotes.length}
        </Text>
      </div>
    </div>
  );
}

