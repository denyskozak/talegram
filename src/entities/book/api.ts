import type { Category } from "@/entities/category/types";
import { trpc } from "@/shared/api/trpc";

import type { Book, CatalogApi, ID, Review } from "./types";

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
    return trpc.catalog.listCategories.query(query satisfies ListCategoriesPayload);
  },
  listGlobalCategories() {
    return trpc.catalog.listGlobalCategories.query();
  },
  listBooks(params) {
    return trpc.catalog.listBooks.query(
      params satisfies ListBooksPayload,
    );
  },
  getBook(id, params) {
    return trpc.catalog.getBook.query({ id, telegramUserId: params?.telegramUserId });
  },
  listReviews(bookId, cursor, limit) {
    return trpc.catalog.listReviews.query({
      bookId,
      cursor,
      limit,
    } satisfies ListReviewsPayload);
  },
  createReview(payload) {
    return trpc.catalog.createReview.mutate(payload satisfies CreateReviewPayload);
  },
};

export function getCategoryTags(categoryId: ID, limit?: number): Promise<string[]> {
  return trpc.catalog.listCategoryTags.query({ categoryId, limit });
}

