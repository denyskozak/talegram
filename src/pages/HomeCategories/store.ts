import { create } from "zustand";

import { catalogApi } from "@/entities/book/api";
import type { Book } from "@/entities/book/types";
import type { Category } from "@/entities/category/types";
import type { GlobalCategory } from "@/shared/lib/globalCategories";

type HomeStore = {
  categories: Category[];
  isCategoriesLoading: boolean;
  categoriesError: string | null;
  categoriesInitialized: boolean;
  categoriesGlobalCategory: GlobalCategory | null;
  categoriesLanguage: string | null;
  topBooks: Book[];
  isTopBooksLoading: boolean;
  topBooksError: string | null;
  topBooksInitialized: boolean;
  topBooksLanguage: string | null;
  loadCategories: (params: {
    globalCategory: GlobalCategory;
    language: string;
    errorMessage: string;
    force?: boolean;
  }) => Promise<void>;
  loadTopBooks: (params: {
    language: string;
    errorMessage: string;
    force?: boolean;
  }) => Promise<void>;
  clearTopBooks: () => void;
};

export const useHomeStore = create<HomeStore>((set, get) => ({
  categories: [],
  isCategoriesLoading: false,
  categoriesError: null,
  categoriesInitialized: false,
  categoriesGlobalCategory: null,
  categoriesLanguage: null,
  topBooks: [],
  isTopBooksLoading: false,
  topBooksError: null,
  topBooksInitialized: false,
  topBooksLanguage: null,
  loadCategories: async ({ globalCategory, language, errorMessage, force = false }) => {
    const { categoriesInitialized, categoriesGlobalCategory, categoriesLanguage } = get();
    if (
      categoriesInitialized &&
      categoriesGlobalCategory === globalCategory &&
      categoriesLanguage === language &&
      !force
    ) {
      return;
    }

    set({ isCategoriesLoading: true, categoriesError: null });

    try {
      const items = await catalogApi.listCategories({ globalCategory, language });
      set({
        categories: items,
        categoriesInitialized: true,
        categoriesGlobalCategory: globalCategory,
        categoriesLanguage: language,
      });
    } catch (error) {
      console.error("Failed to load categories", error);
      set({
        categoriesError: errorMessage,
        categories: [],
        categoriesInitialized: false,
        categoriesLanguage: null,
      });
    } finally {
      set({ isCategoriesLoading: false });
    }
  },
  loadTopBooks: async ({ language, errorMessage, force = false }) => {
    const { topBooksInitialized, topBooksLanguage } = get();
    if (topBooksInitialized && topBooksLanguage === language && !force) {
      return;
    }

    set({ isTopBooksLoading: true, topBooksError: null });

    try {
      const response = await catalogApi.listBooks({
        sort: "popular",
        limit: 10,
        language,
      });

      set({
        topBooks: response.items,
        topBooksInitialized: true,
        topBooksLanguage: language,
      });
    } catch (error) {
      console.error("Failed to load top books", error);
      set({ topBooksError: errorMessage });
    } finally {
      set({ isTopBooksLoading: false });
    }
  },
  clearTopBooks: () =>
    set({
      topBooks: [],
      topBooksError: null,
      topBooksInitialized: false,
      topBooksLanguage: null,
    }),
}));
