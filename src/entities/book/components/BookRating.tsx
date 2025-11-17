import { Text } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { buildStarStates, formatRating } from "@/shared/lib/rating";

interface BookRatingProps {
  value: number;
  votes: number;
}

const STAR_SYMBOLS: Record<"full" | "half" | "empty", string> = {
  full: "★",
  half: "⯨",
  empty: "☆",
};

export function BookRating({ value, votes }: BookRatingProps): JSX.Element {
  const stars = buildStarStates(value);
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Text weight="2" style={{ fontSize: 18 }}>
        {formatRating(value)}
      </Text>
      <Text aria-hidden="true" style={{ color: "#f59e0b", letterSpacing: 2 }}>
        {stars.map((star, index) => (
          <span key={index}>{STAR_SYMBOLS[star]}</span>
        ))}
      </Text>
      <Text style={{ color: "var(--tg-theme-subtitle-text-color, #7f7f81)" }}>{t("book.votes", { count: votes })}</Text>
    </div>
  );
}
