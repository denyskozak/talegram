import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { catalogApi, getCategoryTags } from "@/entities/book/api";
import type { Book, ID } from "@/entities/book/types";
import type { Category } from "@/entities/category/types";
import { BookCard } from "@/entities/book/components/BookCard";
import { getCategoryLabelKey } from "@/shared/lib/categoryTranslations";
import { useIntersectionObserver } from "@/shared/hooks/useIntersectionObserver";
import { useScrollRestoration } from "@/shared/hooks/useScrollRestoration";
import type { BookSort } from "@/shared/lib/bookSort";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { BookCardSkeleton } from "@/shared/ui/Skeletons";
import { FiltersBar } from "@/widgets/FiltersBar/FiltersBar";

export default function CategoryBooks(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: ID }>();
  const { t, i18n } = useTranslation();
  const [category, setCategory] = useState<Category | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<BookSort>("popular");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  useScrollRestoration(`category-${id ?? "unknown"}`);

  const cursorRef = useRef<string | undefined>();

  const loadCategory = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      const allCategories = await catalogApi.listCategories();
      const current = allCategories.find((item) => item.id === id) ?? null;
      setCategory(current);
    } catch (err) {
      console.error(err);
      setError(t("errors.fetchCategory"));
    }
  }, [id, t]);

  const loadBooks = useCallback(
    async (reset = false) => {
      if (!id) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await catalogApi.listBooks({
          categoryId: id,
          cursor: reset ? undefined : cursorRef.current,
          sort,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          language: i18n.language,
        });
        setCursor(response.nextCursor);
        setBooks((prev) => (reset ? response.items : [...prev, ...response.items]));
      } catch (err) {
        console.error(err);
        setError(t("errors.loadBooks"));
      } finally {
        setIsLoading(false);
      }
    },
    [id, i18n.language, selectedTags, sort, t],
  );

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    if (!id) {
      setAvailableTags([]);
      return;
    }

    let cancelled = false;

    const loadTags = async () => {
      try {
        const tags = await getCategoryTags(id, 9);
        if (!cancelled) {
          setAvailableTags(tags);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setAvailableTags([]);
        }
      }
    };

    void loadTags();

    return () => {
      cancelled = true;
    };
  }, [id, i18n.language]);

  useEffect(() => {
    void loadCategory();
  }, [loadCategory]);

  useEffect(() => {
    setBooks([]);
    setCursor(undefined);
    void loadBooks(true);
  }, [id, loadBooks, selectedTags, sort]);

  const handleIntersect = useCallback(() => {
    if (!isLoading && cursorRef.current) {
      void loadBooks(false);
    }
  }, [isLoading, loadBooks]);

  const sentinelRef = useIntersectionObserver(handleIntersect);

  if (!id) {
    return <ErrorBanner message={t("errors.categoryNotFound")} />;
  }

  const categoryTitleKey = category ? getCategoryLabelKey(category.title) : null;
  const localizedTitle = categoryTitleKey
    ? t(categoryTitleKey)
    : category?.title ?? t("book.fallbackCategoryTitle");

  return (
    <main style={{ padding: "16px 16px 32px", margin: "0 auto", maxWidth: 720 }}>
      <Title level="1" weight="2" style={{ marginBottom: 16 }}>
        {localizedTitle}
      </Title>
      <FiltersBar
        sort={sort}
        onSortChange={setSort}
        tags={availableTags}
        selectedTags={selectedTags}
        onToggleTag={(tag) =>
          setSelectedTags((current) =>
            current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
          )
        }
        searchButtonLabel={t("buttons.search")}
        onSearchClick={() => navigate("/search")}
      />
      {error && <ErrorBanner message={error} onRetry={() => loadBooks(true)} />}
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
          <EmptyState title={t("common.notFound")} description={t("categoryBooks.emptyDescription")} />
        )}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {isLoading && books.length > 0 && <BookCardSkeleton />}
      </div>
    </main>
  );
}
