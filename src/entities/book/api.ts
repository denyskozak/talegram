import type { Category } from "@/entities/category/types";
import { callTrpcProcedure } from "@/shared/api/trpc";

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
    return callTrpcProcedure<Category[]>("catalog.listCategories", query satisfies ListCategoriesPayload);
  },
  listBooks(params) {
    return callTrpcProcedure<{ items: Book[]; nextCursor?: string }>("catalog.listBooks", params satisfies ListBooksPayload);
  },
  getBook(id) {
    return callTrpcProcedure<Book>("catalog.getBook", { id });
  },
  listReviews(bookId, cursor, limit) {
    return callTrpcProcedure<{ items: Review[]; nextCursor?: string }>("catalog.listReviews", {
      bookId,
      cursor,
      limit,
    } satisfies ListReviewsPayload);
  },
  createReview(payload) {
    return callTrpcProcedure<Review>("catalog.createReview", payload satisfies CreateReviewPayload);
  },
};

export function getCategoryTags(categoryId: ID, limit?: number): Promise<string[]> {
  return callTrpcProcedure<string[]>("catalog.listCategoryTags", { categoryId, limit });
}

