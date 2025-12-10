import { create } from "zustand";

import { catalogApi } from "@/entities/book/api";
import { purchasesApi } from "@/entities/purchase/api";
import type { MyBook } from "./types";
import { isBookLiked, loadLikedBookIds, persistLikedBookIds, toggleLikedBookId } from "@/shared/lib/likedBooks";

export type MyAccountStore = {
  myBooks: MyBook[];
  isMyBooksLoading: boolean;
  myBooksError: string | null;
  myBooksInitialized: boolean;
  lastLoadedUserId: string | null;
  likedBookIds: Set<string>;
  loadMyBooks: (params: {
    telegramUserId: string | null;
    errorMessage: string;
    force?: boolean;
  }) => Promise<void>;
  toggleLike: (bookId: string, telegramUserId: string | null) => void;
  resetMyBooks: () => void;
};

export const useMyAccountStore = create<MyAccountStore>((set, get) => ({
  myBooks: [],
  isMyBooksLoading: false,
  myBooksError: null,
  myBooksInitialized: false,
  lastLoadedUserId: null,
  likedBookIds: new Set<string>(),
  loadMyBooks: async ({ telegramUserId, errorMessage, force = false }) => {
    const { myBooksInitialized, lastLoadedUserId } = get();
    if (myBooksInitialized && lastLoadedUserId === telegramUserId && !force) {
      return;
    }

    set({ isMyBooksLoading: true, myBooksError: null });

    if (!telegramUserId) {
      set({
        myBooks: [],
        isMyBooksLoading: false,
        myBooksInitialized: true,
        lastLoadedUserId: null,
        likedBookIds: new Set<string>(),
      });
      return;
    }

    try {
      const response = await purchasesApi.list();
      const likedSet = loadLikedBookIds(telegramUserId);
      const items = await Promise.all(
        response.items.map(async (item) => {
          try {
            const book = await catalogApi.getBook(item.bookId);
            if (!book) {
              return null;
            }

            return {
              book,
              purchase: {
                paymentId: item.paymentId,
                purchasedAt: item.purchasedAt,
                walrusBlobId: item.walrusBlobId,
                walrusFileId: item.walrusFileId,
              },
              liked: isBookLiked(book.id, likedSet),
            } satisfies MyBook;
          } catch (error) {
            console.error("Failed to load book details", error);
            return null;
          }
        }),
      );

      const normalized = items.filter((item): item is MyBook => item !== null);
      set({
        myBooks: normalized,
        likedBookIds: likedSet,
        myBooksInitialized: true,
        lastLoadedUserId: telegramUserId,
      });
    } catch (error) {
      console.error("Failed to load purchased books", error);
      set({ myBooksError: errorMessage });
    } finally {
      set({ isMyBooksLoading: false });
    }
  },
  toggleLike: (bookId: string, telegramUserId: string | null) => {
    const { likedBookIds, myBooks } = get();
    const { updated } = toggleLikedBookId(bookId, likedBookIds);
    persistLikedBookIds(updated, telegramUserId);

    set({
      likedBookIds: updated,
      myBooks: myBooks.map((entry) => ({
        ...entry,
        liked: isBookLiked(entry.book.id, updated),
      })),
    });
  },
  resetMyBooks: () =>
    set({
      myBooks: [],
      isMyBooksLoading: false,
      myBooksError: null,
      myBooksInitialized: false,
      lastLoadedUserId: null,
      likedBookIds: new Set<string>(),
    }),
}));
