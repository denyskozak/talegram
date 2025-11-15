import { useCallback, useEffect, useMemo, useState } from "react";
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

type DisplayQuote = Quote & {
  title: string;
};

type QuoteCarouselNoticeProps = {
  theme: ThemeColors;
  t: TFunction<"translation">;
};

const DISPLAY_DURATION_MS = 15000;
const FADE_DURATION_MS = 800;

export function QuoteCarouselNotice({
  theme,
  t,
}: QuoteCarouselNoticeProps): JSX.Element | null {
  const shuffleArray = useCallback(<T,>(items: T[]): T[] => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = temp;
    }
    return copy;
  }, []);

  const quotes = useMemo(() => {
    const translatedSections = t("account.publish.form.quoteCarousel.sections", {
      returnObjects: true,
    });

    if (!Array.isArray(translatedSections)) {
      return [] as DisplayQuote[];
    }

    const normalized = translatedSections as QuoteSection[];

    const flattenedQuotes = normalized.flatMap((section) =>
      (section.quotes ?? []).map((quote) => ({
        ...quote,
        title: section.title,
      })),
    );

    return shuffleArray(flattenedQuotes);
  }, [shuffleArray, t]);

  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setCurrentQuoteIndex(0);
    setIsVisible(true);
  }, [quotes]);

  useEffect(() => {
    if (quotes.length === 0) {
      return undefined;
    }

    const fadeTimeout = setTimeout(() => {
      setIsVisible(false);
    }, Math.max(0, DISPLAY_DURATION_MS - FADE_DURATION_MS));

    const switchTimeout = setTimeout(() => {
      const nextQuoteIndex = currentQuoteIndex + 1;
      const normalizedIndex = nextQuoteIndex % quotes.length;
      setCurrentQuoteIndex(normalizedIndex);

      setIsVisible(true);
    }, DISPLAY_DURATION_MS);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(switchTimeout);
    };
  }, [currentQuoteIndex, quotes]);

  const currentQuote = quotes[currentQuoteIndex];

  if (!currentQuote) {
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

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Text style={{ color: theme.text }}>
            <span style={{ color: theme.subtitle }}>{currentQuote.title}:</span> {currentQuote.english}
          </Text>

        </div>
        <Text style={{ color: theme.subtitle, fontSize: 12 }}>
          {currentQuoteIndex + 1} / {quotes.length}
        </Text>
      </div>
    </div>
  );
}

