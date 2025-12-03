import { useEffect, useState } from "react";
import { Card, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@/app/providers/ThemeProvider";
import { fetchMyPublishedBooks } from "@/entities/author/api";
import type { PublishedBook } from "@/entities/author/types";
import { Button } from "@/shared/ui/Button";

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function PublishedBooks(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [books, setBooks] = useState<PublishedBook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchMyPublishedBooks();
        if (isMounted) {
          setBooks(response);
        }
      } catch (err) {
        console.error("Failed to load published books", err);
        if (isMounted) {
          setError(t("account.published.loadError"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [t]);

  return (
    <div
      style={{
        margin: "0 auto",
        maxWidth: 720,
        padding: "24px 16px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title level="1" weight="2">
          {t("account.published.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.published.subtitle")}</Text>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" mode="outline" onClick={() => navigate("/account")}>
            {t("account.published.back")}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.published.loading")}</Text>
        </Card>
      ) : error ? (
        <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Text style={{ color: theme.subtitle }}>{error}</Text>
          <Button type="button" mode="outline" size="s" onClick={() => window.location.reload()}>
            {t("account.published.retry")}
          </Button>
        </Card>
      ) : books.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.published.empty")}</Text>
        </Card>
      ) : (
        books.map((book) => (
          <Card key={book.id} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Title level="3" weight="2">
                  {book.title}
                </Title>
                <Text style={{ color: theme.subtitle }}>
                  {t("account.published.language", {
                    value: book.language ?? t("account.published.languageUnknown"),
                  })}
                </Text>
                <Text style={{ color: theme.subtitle }}>
                  {t("account.published.publishedAt", { value: formatDate(book.publishedAt) })}
                </Text>
                <Text style={{ color: theme.subtitle }}>
                  {t("account.published.price", { value: book.price, currency: book.currency })}
                </Text>
              </div>
              <Button
                type="button"
                size="m"
                mode="outline"
                onClick={() => navigate(`/account/published/${book.id}`)}
              >
                {t("account.published.viewDetails")}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
