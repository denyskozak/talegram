import { Card, Chip, Text, Title } from "@telegram-apps/telegram-ui";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import type { MyBook } from "../types";

export type MyBooksSectionProps = {
  books: MyBook[];
  theme: ThemeColors;
  t: TFunction<"translation">;
};

export function MyBooksSection({ books, theme, t }: MyBooksSectionProps): JSX.Element {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title level="2" weight="2">
          {t("account.myBooks.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.myBooks.description")}</Text>
      </div>
      {books.map((book) => (
        <Card key={book.id} style={{ padding: 16 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <img
              src={book.cover}
              alt={t("account.myBooks.coverAlt", { title: book.title })}
              style={{
                width: 96,
                height: 128,
                borderRadius: 12,
                objectFit: "cover",
                boxShadow: "0 8px 16px rgba(0, 0, 0, 0.12)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <div>
                <Title level="3" weight="2">
                  {book.title}
                </Title>
                <Text style={{ color: theme.subtitle }}>{book.author}</Text>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Chip mode="elevated">{t("account.myBooks.tonBadge")}</Chip>
                <Chip mode="outline">{book.collection}</Chip>
                <Chip mode="outline">{t(`account.myBooks.status.${book.status}`)}</Chip>
              </div>
              <Text style={{ color: theme.hint }}>
                {t("account.myBooks.token", { token: book.tokenId })}
              </Text>
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}
