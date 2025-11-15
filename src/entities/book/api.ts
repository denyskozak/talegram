import { trpc } from "@/shared/api/trpc";

import type { Book, CatalogApi, ID } from "./types";

type ListCategoriesPayload = {
  search?: string;
  globalCategory?: string;
};

type ListBooksPayload = {
  categoryId?: ID;
  search?: string;
  sort?: "popular" | "rating" | "new";
  tags?: string[];
  cursor?: string;
  limit?: number;
};

type ListReviewsPayload = {
  bookId: ID;
  cursor?: string;
  limit?: number;
};

type CreateReviewPayload = {
  bookId: ID;
  authorName: string;
  rating: number;
  text: string;
};

export const catalogApi: CatalogApi = {
  listCategories(query) {
    const payload: ListCategoriesPayload | undefined = query
      ? {
          search: query.search,
          globalCategory: query.globalCategory,
        }
      : undefined;

    return trpc.catalog.listCategories.query(payload);
  },
  listGlobalCategories() {
    return trpc.catalog.listGlobalCategories.query();
  },
  listBooks(params) {
    return trpc.catalog.listBooks
      .query(params satisfies ListBooksPayload)
      .then((response: { items: Book[]; nextCursor?: string }) => ({
        items: response.items as Book[],
        nextCursor: response.nextCursor,
      }));
  },
  getBook(id, params) {
    return trpc.catalog.getBook
      .query({ id, telegramUserId: params?.telegramUserId })
      .then((book: Book) => book as Book);
  },
  listReviews(bookId, cursor, limit) {
    const payload: ListReviewsPayload = { bookId };
    if (typeof cursor === "string") {
      payload.cursor = cursor;
    }
    if (typeof limit === "number") {
      payload.limit = limit;
    }

    return trpc.catalog.listReviews.query(payload);
  },
  createReview(payload) {
    const normalizedPayload: CreateReviewPayload = {
      bookId: payload.bookId,
      authorName: payload.authorName,
      rating: payload.rating,
      text: payload.text,
    };

    return trpc.catalog.createReview.mutate(normalizedPayload);
  },
};

export function getCategoryTags(categoryId: ID, limit?: number): Promise<string[]> {
  return trpc.catalog.listCategoryTags.query({ categoryId, limit });
}

