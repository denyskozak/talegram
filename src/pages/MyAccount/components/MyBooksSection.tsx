import { Button, Card, Chip, Text, Title } from "@telegram-apps/telegram-ui";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import type { MyBook } from "../types";

import { useWalrusCover } from "@/entities/book/hooks/useWalrusCover";

export type MyBooksSectionProps = {
  books: MyBook[];
  theme: ThemeColors;
  t: TFunction<"translation">;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
};

type MyBookCardProps = {
  item: MyBook;
  theme: ThemeColors;
  t: TFunction<"translation">;
};

function formatPurchaseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function MyBookCard({ item, theme, t }: MyBookCardProps): JSX.Element {
  const { book, purchase } = item;
  const coverUrl = useWalrusCover(book.coverWalrusBlobId, book.coverMimeType);
  const author = book.authors.join(", ");
  const fallbackInitial = book.title.trim().charAt(0).toUpperCase() || "📘";
  const formattedPurchasedAt = formatPurchaseDate(purchase.purchasedAt);

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 16 }}>
        <div
          style={{
            width: 96,
            height: 128,
            borderRadius: 12,
            overflow: "hidden",
            background: coverUrl ? "transparent" : `${theme.accent}22`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 16px rgba(0, 0, 0, 0.12)",
            color: theme.accent,
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={t("account.myBooks.coverAlt", { title: book.title })}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            fallbackInitial
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <div>
            <Title level="3" weight="2">
              {book.title}
            </Title>
            {author.length > 0 && <Text style={{ color: theme.subtitle }}>{author}</Text>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip mode="elevated">{t("account.myBooks.tonBadge")}</Chip>
            <Chip mode="outline">{t("account.myBooks.status.owned")}</Chip>
            <Chip mode="outline">{t("account.myBooks.purchased", { value: formattedPurchasedAt })}</Chip>
          </div>
          <Text style={{ color: theme.hint }}>
            {t("account.myBooks.paymentId", { id: purchase.paymentId })}
          </Text>
        </div>
      </div>
    </Card>
  );
}

export function MyBooksSection({
  books,
  theme,
  t,
  isLoading,
  error,
  onRetry,
}: MyBooksSectionProps): JSX.Element {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title level="2" weight="2">
          {t("account.myBooks.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.myBooks.description")}</Text>
      </div>
      {isLoading ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.myBooks.loading")}</Text>
        </Card>
      ) : error ? (
        <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Text style={{ color: theme.subtitle }}>{error}</Text>
          <Button type="button" mode="outline" size="s" onClick={onRetry}>
            {t("account.myBooks.retry")}
          </Button>
        </Card>
      ) : books.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.myBooks.empty")}</Text>
        </Card>
      ) : (
        books.map((item) => <MyBookCard key={item.book.id} item={item} theme={theme} t={t} />)
      )}
    </section>
  );
}
