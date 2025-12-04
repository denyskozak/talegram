import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { catalogApi } from "@/entities/book/api";
import type { Book } from "@/entities/book/types";
import {
  SPECIAL_CATEGORY_MAP,
  type SpecialCategoryId,
  isSpecialCategoryId,
} from "@/entities/category/customCategories";
import { BookCard } from "@/entities/book/components/BookCard";
import { useScrollRestoration } from "@/shared/hooks/useScrollRestoration";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { BookCardSkeleton } from "@/shared/ui/Skeletons";

export default function TopBooks(): JSX.Element {
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const categoryId = type && isSpecialCategoryId(type) ? (type as SpecialCategoryId) : null;
  const category = categoryId ? SPECIAL_CATEGORY_MAP[categoryId] : null;
  const { t } = useTranslation();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useScrollRestoration(`top-categories-${categoryId ?? type ?? "unknown"}`);

  const categoryTitle = useMemo(
    () => (category ? t(category.titleKey) : ""),
    [category, t],
  );

  useEffect(() => {
    if (!category) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setBooks([]);
        const response = await catalogApi.listBooks({
          limit: category.booksCount,
          sort: category.sort,
        });
        if (!cancelled) {
          setBooks(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(t("errors.loadBooks"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [category, refreshToken, t]);

  const handleRetry = () => setRefreshToken((prev) => prev + 1);

  if (!category) {
    return <ErrorBanner message={t("errors.categoryNotFound")} onRetry={() => navigate("/")} />;
  }

  return (
    <main style={{ padding: "16px 16px 32px", margin: "0 auto", maxWidth: 720 }}>
      <Title level="1" weight="2" style={{ marginBottom: 16 }}>
        {categoryTitle}
      </Title>
      {error && <ErrorBanner message={error} onRetry={handleRetry} />}
      <div style={{
          display: "grid",
          gridAutoFlow: "column", // новые элементы добавляются в новые колонки
          gridTemplateRows: "repeat(2, minmax(0, 1fr))", // 3 строки (3 элемента в столбце)
          gridAutoColumns: "calc(50% - 8px)", // ширина одной колонки ~ половина контейнера
          // overflowX: "auto", // горизонтальный скролл
          columnGap: 16,
          rowGap: 16,
          paddingRight: 4,
          paddingBottom: 4,
          marginTop: 8,
      }}>
        {books.map((book) => (
          <BookCard key={book.id} book={book} onClick={() => navigate(`/book/${book.id}`)} />
        ))}
        {isLoading && books.length === 0 && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <BookCardSkeleton key={index} />
            ))}
          </>
        )}
        {!isLoading && books.length === 0 && !error && (
          <EmptyState title={t("common.notFound")} description={t("common.tryLater")} />
        )}
        {isLoading && books.length > 0 && <BookCardSkeleton />}
      </div>
    </main>
  );
}
