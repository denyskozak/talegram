import type { Category } from "@/entities/category/types";
import { trpc } from "@/shared/api/trpc";

import type { Book, CatalogApi, ID, Review } from "./types";

type ListCategoriesPayload = {
  search?: string;
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
    return trpc.query("catalog.listCategories", query satisfies ListCategoriesPayload);
  },
  listBooks(params) {
    return trpc.query(
      "catalog.listBooks",
      params satisfies ListBooksPayload,
    );
  },
  getBook(id) {
    return trpc.query("catalog.getBook", { id });
  },
  listReviews(bookId, cursor, limit) {
    return trpc.query("catalog.listReviews", {
      bookId,
      cursor,
      limit,
    } satisfies ListReviewsPayload);
  },
  createReview(payload) {
    return trpc.mutation("catalog.createReview", payload satisfies CreateReviewPayload);
  },
};

export function getCategoryTags(categoryId: ID, limit?: number): Promise<string[]> {
  return trpc.query("catalog.listCategoryTags", { categoryId, limit });
}

