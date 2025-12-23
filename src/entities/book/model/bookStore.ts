import { create } from "zustand";

import { catalogApi } from "@/entities/book/api";
import type { Book, ID } from "@/entities/book/types";

export type BookStoreState = {
  books: Record<string, Book | null>;
  similarByBook: Record<string, Book[]>;
  loadingByBook: Record<string, boolean>;
  errorByBook: Record<string, string | null>;
  loadBook: (params: {
    id: ID;
    language: string;
    errorMessage: string;
    force?: boolean;
  }) => Promise<void>;
  updateBook: (id: ID, updater: (book: Book) => Book) => void;
};

export const useBookStore = create<BookStoreState>((set, get) => ({
  books: {},
  similarByBook: {},
  loadingByBook: {},
  errorByBook: {},
  loadBook: async ({ id, language, errorMessage, force = false }) => {
    const { books } = get();
    if (books[id] && !force) {
      return;
    }

    set((state) => ({
      loadingByBook: { ...state.loadingByBook, [id]: true },
      errorByBook: { ...state.errorByBook, [id]: null },
    }));

    try {
      const item = await catalogApi.getBook(id, language);
      let similarBooks: Book[] = [];

      if (item?.similarBooks && item.similarBooks.length > 0) {
        const resolved = await Promise.all(
          item.similarBooks.map(async (similarId) => {
            if (similarId === item.id) {
              return null;
            }

            try {
              return await catalogApi.getBook(similarId, language);
            } catch (error) {
              console.warn('Failed to load similar book', { id: similarId, error });
              return null;
            }
          }),
        );

        similarBooks = resolved.filter((book): book is Book => Boolean(book)).slice(0, 6);
      } else if (item?.categories) {
        const similarBooksResponse = await catalogApi.listBooks({
          categoryId: item.categories,
          limit: 12,
          language,
        });
        similarBooks = similarBooksResponse.items.filter((entry) => entry.id !== item.id).slice(0, 6);
      }

      set((state) => ({
        similarByBook: {
          ...state.similarByBook,
          [id]: similarBooks,
        },
      }));

      set((state) => ({ books: { ...state.books, [id]: item } }));
    } catch (err) {
      console.error(err);
      set((state) => ({
        errorByBook: { ...state.errorByBook, [id]: errorMessage },
        books: { ...state.books, [id]: null },
      }));
    } finally {
      set((state) => ({ loadingByBook: { ...state.loadingByBook, [id]: false } }));
    }
  },
  updateBook: (id, updater) => {
    set((state) => {
      const current = state.books[id];
      if (!current) {
        return state;
      }

      return {
        ...state,
        books: {
          ...state.books,
          [id]: updater(current),
        },
      };
    });
  },
}));
