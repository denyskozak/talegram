import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Banner, Input, SegmentedControl, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { CategoryTile } from "@/entities/category/components/CategoryTile";
import type { Category } from "@/entities/category/types";
import {
  SPECIAL_CATEGORIES,
  SPECIAL_CATEGORY_MAP,
  type SpecialCategory,
  isSpecialCategoryId,
} from "@/entities/category/customCategories";
import {
  DEFAULT_GLOBAL_CATEGORY,
  GLOBAL_CATEGORY_SEGMENTS,
  findGlobalCategoryByCategoryTitle,
  type GlobalCategoryValue,
} from "@/entities/category/globalCategories";
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
  const [globalCategory, setGlobalCategory] = useState<GlobalCategoryValue>(DEFAULT_GLOBAL_CATEGORY);
  const debouncedSearch = useDebouncedValue(search, 250);
  const normalizedSearch = debouncedSearch.trim().toLocaleLowerCase();

  useScrollRestoration(`home-categories-${normalizedSearch || "all"}`);

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

  const specialCategories: SpecialCategory[] = useMemo(() => {
    if (globalCategory !== DEFAULT_GLOBAL_CATEGORY) {
      return [];
    }

    if (!normalizedSearch) {
      return translatedSpecialCategories;
    }

    return translatedSpecialCategories.filter((category) =>
      [category.title, category.slug].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      ),
    );
  }, [globalCategory, normalizedSearch, translatedSpecialCategories]);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) => {
        const categoryGlobal = findGlobalCategoryByCategoryTitle(category.title);
        if (!categoryGlobal) {
          return globalCategory === DEFAULT_GLOBAL_CATEGORY;
        }

        return categoryGlobal === globalCategory;
      }),
    [categories, globalCategory],
  );

  const displayedCategories: Category[] = [...specialCategories, ...filteredCategories];

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
      <SegmentedControl style={{ marginBottom: 16 }}>
        {GLOBAL_CATEGORY_SEGMENTS.map((segment) => (
          <SegmentedControl.Item
            key={segment.value}
            selected={segment.value === globalCategory}
            onClick={() => setGlobalCategory(segment.value)}
          >
            {t(segment.labelKey, segment.defaultLabel)}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
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
