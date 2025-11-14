import type { TFunction } from "i18next";

export const GLOBAL_CATEGORY_SEGMENTS = [
  { value: "article", labelKey: "globalCategories.article", defaultLabel: "Articles" },
  { value: "book", labelKey: "globalCategories.book", defaultLabel: "Books" },
  { value: "comics", labelKey: "globalCategories.comics", defaultLabel: "Comics" },
] as const;

export type GlobalCategoryValue = (typeof GLOBAL_CATEGORY_SEGMENTS)[number]["value"];

export const DEFAULT_GLOBAL_CATEGORY: GlobalCategoryValue = "book";

export function isGlobalCategoryValue(value: string): value is GlobalCategoryValue {
  return GLOBAL_CATEGORY_SEGMENTS.some((category) => category.value === value);
}

const CATEGORY_LABELS_BY_GLOBAL: Record<GlobalCategoryValue, readonly string[]> = {
  book: [
    "Science Fiction",
    "Fantasy",
    "Mystery & Thrillers",
    "Novels / Literary Fiction",
    "Non-Fiction",
    "Self-Help & Psychology",
    "History",
    "Biographies & Memoirs",
    "Business & Finance",
    "Children’s Literature",
  ],
  article: [
    "News & Politics",
    "Science & Technology",
    "Business & Economics",
    "Education",
    "Sports",
    "Entertainment (movies, music, showbiz)",
    "Travel",
    "Lifestyle",
    "Health & Medicine",
    "Culture & Arts",
  ],
  comics: [
    "Superheroes",
    "Manga",
    "Fantasy",
    "Science Fiction",
    "Horror",
    "Adventure",
    "Comedy / Satire",
    "Crime / Noir",
    "Romance",
    "Historical Comics",
  ],
} as const;

const CATEGORY_LOOKUP = new Map<string, GlobalCategoryValue>();
for (const [globalCategory, categories] of Object.entries(CATEGORY_LABELS_BY_GLOBAL)) {
  for (const category of categories) {
    const normalized = category.toLocaleLowerCase();
    if (!CATEGORY_LOOKUP.has(normalized)) {
      CATEGORY_LOOKUP.set(normalized, globalCategory as GlobalCategoryValue);
    }
  }
}

export function getCategoryLabelsByGlobal(globalCategory: GlobalCategoryValue): readonly string[] {
  return CATEGORY_LABELS_BY_GLOBAL[globalCategory];
}

export function getCategoryOptionsByGlobal(globalCategory: GlobalCategoryValue): Array<{
  value: string;
  label: string;
}> {
  return CATEGORY_LABELS_BY_GLOBAL[globalCategory].map((label) => ({ value: label, label }));
}

export function findGlobalCategoryByCategoryTitle(title: string): GlobalCategoryValue | null {
  const normalized = title.trim().toLocaleLowerCase();
  return CATEGORY_LOOKUP.get(normalized) ?? null;
}

export function getGlobalCategoryLabel(
  globalCategory: string,
  t: TFunction<"translation">,
): string {
  const normalized = globalCategory.trim().toLocaleLowerCase();
  const match = GLOBAL_CATEGORY_SEGMENTS.find((category) => category.value === normalized);
  if (!match) {
    return globalCategory;
  }

  return t(match.labelKey, match.defaultLabel);
}
