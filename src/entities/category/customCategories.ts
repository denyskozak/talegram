import type { Category } from "./types";
import type { BookSort } from "@/shared/lib/bookSort";
import { TOTAL_BOOKS_COUNT } from "@/entities/book/constants";

type SpecialCategoryBase = {
  id: "most-read" | "top-rated";
  titleKey: "categories.special.mostRead" | "categories.special.topRated";
  defaultTitle: string;
  slug: string;
  emoji: string;
  sort: BookSort;
};

const SPECIAL_CATEGORIES_BASE: readonly SpecialCategoryBase[] = [
  {
    id: "most-read",
    titleKey: "categories.special.mostRead",
    defaultTitle: "Самые читаемые",
    slug: "most-read",
    emoji: "📖",
    sort: "popular",
  },
  {
    id: "top-rated",
    titleKey: "categories.special.topRated",
    defaultTitle: "Самые рейтинговые",
    slug: "top-rated",
    emoji: "⭐",
    sort: "rating",
  },
] as const;

export type SpecialCategoryId = (typeof SPECIAL_CATEGORIES_BASE)[number]["id"];
export type SpecialCategory = Category & {
  id: SpecialCategoryId;
  sort: BookSort;
  path: string;
  titleKey: SpecialCategoryBase["titleKey"];
};

export const SPECIAL_CATEGORIES: SpecialCategory[] = SPECIAL_CATEGORIES_BASE.map(
  ({ defaultTitle, ...category }) => ({
    ...category,
    title: defaultTitle,
    // booksCount: TOTAL_BOOKS_COUNT,
    path: `/top/${category.slug}`,
  }),
) satisfies SpecialCategory[];

export const SPECIAL_CATEGORY_MAP: Record<SpecialCategoryId, SpecialCategory> = Object.fromEntries(
  SPECIAL_CATEGORIES.map((category) => [category.id, category]),
) as Record<SpecialCategoryId, SpecialCategory>;

export function isSpecialCategoryId(value: string): value is SpecialCategoryId {
  return value in SPECIAL_CATEGORY_MAP;
}
