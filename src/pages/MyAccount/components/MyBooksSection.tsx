import { useMemo } from "react";

import { Button, Card, Chip, SegmentedControl, Text, Title } from "@telegram-apps/telegram-ui";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import type { MyBook, MyBooksFilter } from "../types";

import { useWalrusCover } from "@/entities/book/hooks/useWalrusCover";

export type MyBooksSectionProps = {
  books: MyBook[];
  theme: ThemeColors;
  t: TFunction<"translation">;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onRead: (bookId: string) => void;
  onDownload: (bookId: string) => void;
  downloadingBookId: string | null;
  filter: MyBooksFilter;
  onFilterChange: (value: MyBooksFilter) => void;
  onToggleLike: (bookId: string) => void;
};

type MyBookCardProps = {
  item: MyBook;
  theme: ThemeColors;
  t: TFunction<"translation">;
  onRead: (bookId: string) => void;
  onDownload: (bookId: string) => void;
  downloadingBookId: string | null;
  onToggleLike: (bookId: string) => void;
};

function formatPurchaseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function MyBookCard({
  item,
  theme,
  t,
  onRead,
  onDownload,
  downloadingBookId,
  onToggleLike,
}: MyBookCardProps): JSX.Element {
  const { book, purchase } = item;
  const walrusCoverUrl = useWalrusCover(
    book.coverImageData ? null : book.coverWalrusFileId,
    book.coverMimeType,
  );
  const coverUrl = useMemo(() => {
    if (book.coverImageData) {
      const mimeType = book.coverMimeType ?? "image/jpeg";
      return `data:${mimeType};base64,${book.coverImageData}`;
    }

    return walrusCoverUrl;
  }, [book.coverImageData, book.coverMimeType, walrusCoverUrl]);
  const author = book.authors.join(", ");
  const fallbackInitial = book.title.trim().charAt(0).toUpperCase() || "📘";
  const formattedPurchasedAt = formatPurchaseDate(purchase.purchasedAt);
  const isDownloading = downloadingBookId === book.id;

  return (
    <Card style={{ padding: 16, position: "relative" }}>
      <button
        type="button"
        onClick={() => onToggleLike(book.id)}
        aria-pressed={item.liked}
        aria-label={
          item.liked
            ? t("account.myBooks.unlike", { title: book.title })
            : t("account.myBooks.like", { title: book.title })
        }
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          border: "none",
          background: "transparent",
          padding: 4,
          cursor: "pointer",
          fontSize: 20,
          lineHeight: 1,
          color: item.liked ? theme.accent : theme.subtitle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span aria-hidden="true">{item.liked ? "❤️" : "🤍"}</span>
      </button>
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
            <Chip mode="outline">{t("account.myBooks.status.owned")}</Chip>
            <Chip mode="outline">{t("account.myBooks.purchased", { value: formattedPurchasedAt })}</Chip>
            {item.liked && (
              <Chip mode="outline" aria-label={t("account.myBooks.status.liked")}>
                <span aria-hidden="true" style={{ marginRight: 4 }}>❤️</span>
                {t("account.myBooks.status.liked")}
              </Chip>
            )}
          </div>
          <Text style={{ color: theme.hint }}>
            {t("account.myBooks.paymentId", { id: purchase.paymentId })}
          </Text>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <Button
              type="button"
              size="l"
              onClick={() => onRead(book.id)}
            >
              {t("account.myBooks.actions.read")}
            </Button>
            <Button
              type="button"
              size="l"
              mode="outline"
              disabled={isDownloading}
              loading={isDownloading}
              onClick={() => onDownload(book.id)}
            >
              {t("account.myBooks.actions.download")}
            </Button>
          </div>
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
  onRead,
  onDownload,
  downloadingBookId,
  filter,
  onFilterChange,
  onToggleLike,
}: MyBooksSectionProps): JSX.Element {
  const filteredBooks = useMemo(
    () => (filter === "liked" ? books.filter((item) => item.liked) : books),
    [books, filter],
  );

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SegmentedControl>
        <SegmentedControl.Item
          selected={filter === "purchased"}
          onClick={() => onFilterChange("purchased")}
        >
          {t("account.myBooks.filters.purchased")}
        </SegmentedControl.Item>
        <SegmentedControl.Item
          selected={filter === "liked"}
          onClick={() => onFilterChange("liked")}
        >
          {t("account.myBooks.filters.liked")}
        </SegmentedControl.Item>
      </SegmentedControl>
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
      ) : filter === "liked" && filteredBooks.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.myBooks.emptyLiked")}</Text>
        </Card>
      ) : (
        filteredBooks.map((item) => (
          <MyBookCard
            key={item.book.id}
            item={item}
            theme={theme}
            t={t}
            onRead={onRead}
            onDownload={onDownload}
            downloadingBookId={downloadingBookId}
            onToggleLike={onToggleLike}
          />
        ))
      )}
    </section>
  );
}
