import { useEffect, useMemo, useState } from "react";
import { Card, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useTheme } from "@/app/providers/ThemeProvider";
import { fetchPublishedBook } from "@/entities/author/api";
import type { PublishedBookDetails, PublishedBookSale } from "@/entities/author/types";
import { Button } from "@/shared/ui/Button";

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type SaleDetailsProps = {
  sale: PublishedBookSale;
  theme: ReturnType<typeof useTheme>;
  t: ReturnType<typeof useTranslation>["t"];
};

function SaleDetails({ sale, theme, t }: SaleDetailsProps): JSX.Element {
  return (
    <Card style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
      <Text style={{ color: theme.subtitle }}>
        {t("account.published.saleBuyer", { id: sale.telegramUserId })}
      </Text>
      <Text style={{ color: theme.subtitle }}>
        {t("account.published.salePayment", { id: sale.paymentId })}
      </Text>
      <Text style={{ color: theme.hint }}>
        {t("account.published.salePurchasedAt", { value: formatDate(sale.purchasedAt) })}
      </Text>
    </Card>
  );
}

export default function PublishedBook(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<PublishedBookDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError(t("account.published.details.notFound"));
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchPublishedBook(id);
        if (!isCancelled) {
          setBook(response);
        }
      } catch (err) {
        console.error("Failed to load published book", err);
        if (!isCancelled) {
          setError(t("account.published.details.loadError"));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [id, t]);

  const salesCountLabel = useMemo(
    () => (book ? t("account.published.details.salesCount", { count: book.sales.length }) : ""),
    [book, t],
  );

  const earningsLabel = useMemo(
    () =>
      book
        ? t("account.published.details.earnings", {
            value: book.earnings.total,
            currency: book.earnings.currency,
          })
        : "",
    [book, t],
  );

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
          {book?.title ?? t("account.published.details.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>
          {t("account.published.details.subtitle")}
        </Text>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button type="button" mode="outline" onClick={() => navigate("/account/published")}>
            {t("account.published.details.back")}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.published.details.loading")}</Text>
        </Card>
      ) : error ? (
        <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Text style={{ color: theme.subtitle }}>{error}</Text>
          <Button type="button" mode="outline" size="s" onClick={() => window.location.reload()}>
            {t("account.published.retry")}
          </Button>
        </Card>
      ) : !book ? (
        <Card style={{ padding: 16 }}>
          <Text style={{ color: theme.subtitle }}>{t("account.published.details.notFound")}</Text>
        </Card>
      ) : (
        <>
          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <Title level="3" weight="2">
              {t("account.published.details.info")}
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
            <Text style={{ color: theme.subtitle }}>{salesCountLabel}</Text>
            <Text style={{ color: theme.subtitle }}>{earningsLabel}</Text>
          </Card>

          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Title level="3" weight="2">
              {t("account.published.details.buyers")}
            </Title>
            {book.sales.length === 0 ? (
              <Text style={{ color: theme.subtitle }}>{t("account.published.noSales")}</Text>
            ) : (
              book.sales.map((sale) => (
                <SaleDetails
                  key={`${sale.paymentId}-${sale.telegramUserId}-${sale.purchasedAt}`}
                  sale={sale}
                  theme={theme}
                  t={t}
                />
              ))
            )}
          </Card>
        </>
      )}
    </div>
  );
}
