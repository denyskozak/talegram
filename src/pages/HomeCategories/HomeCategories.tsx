import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Banner, Input, SegmentedControl, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { CategoryTile } from "@/entities/category/components/CategoryTile";
import type { Category } from "@/entities/category/types";
import {
  SPECIAL_CATEGORIES,
  SPECIAL_CATEGORY_MAP,
  type SpecialCategory,
  isSpecialCategoryId,
} from "@/entities/category/customCategories";
import { catalogApi } from "@/entities/book/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { useScrollRestoration } from "@/shared/hooks/useScrollRestoration";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { CategoryTileSkeleton } from "@/shared/ui/Skeletons";
import {trpc} from "@/shared/api/trpc.ts";

export default function HomeCategories(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [globalCategories, setGlobalCategories] = useState<string[]>([]);
  const [selectedGlobalCategory, setSelectedGlobalCategory] = useState("book");
  const [globalCategoriesError, setGlobalCategoriesError] = useState<string | null>(null);
  const [globalRefreshToken, setGlobalRefreshToken] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 250);
  const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase();

  useScrollRestoration(`home-categories-${normalizedSearch || "all"}`);

  useEffect(() => {
    let cancelled = false;

    const loadGlobalCategories = async () => {
      try {
        setGlobalCategoriesError(null);
        const items = await catalogApi.listGlobalCategories();
        if (cancelled) {
          return;
        }

        const normalizedItems = Array.from(
          new Set(
            items
              .map((item) => item.trim().toLocaleLowerCase())
              .filter((item): item is string => item.length > 0),
          ),
        );
        setGlobalCategories(normalizedItems);

        const preferred = normalizedItems.includes("book")
          ? "book"
          : normalizedItems[0];
        if (preferred) {
          setSelectedGlobalCategory(preferred);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setGlobalCategoriesError(t("errors.loadGlobalCategories"));
        }
      }
    };

    void loadGlobalCategories();

    return () => {
      cancelled = true;
    };
  }, [globalRefreshToken, t]);

  const translatedSpecialCategories = useMemo<SpecialCategory[]>(
    () =>
      SPECIAL_CATEGORIES.map((category) => ({
        ...category,
        title: t(category.titleKey),
      })),
    [t],
  );
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const items = await catalogApi.listCategories(
          debouncedSearch ? { search: debouncedSearch } : undefined,
        );
        if (!cancelled) {
          setCategories(items);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(t("errors.loadCategories"));
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
  }, [debouncedSearch, refreshToken, t]);

  const specialCategories: SpecialCategory[] = normalizedSearch
    ? translatedSpecialCategories.filter((category) =>
        [category.title, category.slug].some((value) =>
          value.toLocaleLowerCase().includes(normalizedSearch),
        ),
      )
    : translatedSpecialCategories;

  const orderedGlobalCategories = useMemo(() => {
    if (globalCategories.length === 0) {
      return [];
    }

    const preferredOrder = ["article", "book", "comic"];
    const sorted = [...globalCategories].sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);

      if (indexA === -1 && indexB === -1) {
        return a.localeCompare(b);
      }
      if (indexA === -1) {
        return 1;
      }
      if (indexB === -1) {
        return -1;
      }

      return indexA - indexB;
    });

    return sorted;
  }, [globalCategories]);

  const displayedCategories: Category[] = [...specialCategories, ...categories];

  const handleGlobalCategoriesRetry = () => {
    setGlobalRefreshToken((prev) => prev + 1);
  };

  const handleCategoryClick = (category: Category) => {
    if (isSpecialCategoryId(category.id)) {
      navigate(SPECIAL_CATEGORY_MAP[category.id].path);
      return;
    }

    navigate(`/category/${category.id}`);
  };

  return (
    <main style={{ padding: "16px 16px 32px", margin: "0 auto", maxWidth: 720 }}>
      <Banner
        header={t("homeCategories.alphaBanner.title")}
        subheader={t("homeCategories.alphaBanner.description")}
        style={{ marginBottom: 16 }}
      />
      <Title level="1" weight="2" style={{ marginBottom: 16 }}>
        {t("homeCategories.title")}
      </Title>
      {globalCategoriesError ? (
        <ErrorBanner
          style={{ margin: "16px 0" }}
          message={globalCategoriesError}
          onRetry={handleGlobalCategoriesRetry}
        />
      ) : null}
      {orderedGlobalCategories.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          <Text weight="2">{t("homeCategories.globalCategoryLabel")}</Text>
          <SegmentedControl
            value={selectedGlobalCategory}
            onChange={(value) => setSelectedGlobalCategory(value as string)}
          >
            {orderedGlobalCategories.map((category) => (
              <SegmentedControl.Item key={category} value={category}>
                {t(`globalCategories.${category}`, {
                  defaultValue: `${category.charAt(0).toUpperCase()}${category.slice(1)}`,
                })}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl>
        </div>
      ) : null}
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("homeCategories.searchPlaceholder")}
        aria-label={t("homeCategories.searchPlaceholder")}
        style={{ marginBottom: 16 }}
      />
      {error && <ErrorBanner  style={{  margin: "16px 0" }} message={error} onRetry={() => setRefreshToken((prev) => prev + 1)} />}
      {isLoading && displayedCategories.length === 0 ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <CategoryTileSkeleton key={index} />
          ))}
        </div>
      ) : displayedCategories.length > 0 ? (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {displayedCategories.map((category) => (
            <CategoryTile
              key={category.id}
              category={category}
              onClick={() => handleCategoryClick(category)}
            />
          ))}
        </div>
      ) : (
        !isLoading && (
          <EmptyState
            title={t("homeCategories.emptyTitle")}
            description={t("homeCategories.emptyDescription")}
          />
        )
      )}
    </main>
  );
}
