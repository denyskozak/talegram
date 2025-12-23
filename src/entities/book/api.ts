import { trpc } from "@/shared/api/trpc";

import type { Book, CatalogApi, ID } from "./types";

type ListCategoriesPayload = {
  search?: string;
  globalCategory?: "article" | "book" | "comics";
  language?: string;
};

type ListBooksPayload = {
  categoryId?: ID;
  search?: string;
  sort?: "popular" | "rating" | "new";
  tags?: string[];
  cursor?: string;
  limit?: number;
  language?: string;
};

type ListReviewsPayload = {
  bookId: ID;
  cursor?: string;
  limit?: number;
};

type CreateReviewPayload = {
  bookId: ID;
  authorName: string;
  authorImage?: string | null;
  rating: number;
  text: string;
};

export const catalogApi: CatalogApi = {
  listCategories(query) {
    const payload: ListCategoriesPayload | undefined = query
      ? {
          search: query.search as any,
          globalCategory: query.globalCategory as any,
          language: query.language as any,
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
  listAudiobooks(language: string) {
    return trpc.catalog.listAudiobooks.query({ language }).then((items: Book[]) => items as Book[]);
  },
  getBook(id) {
    return trpc.catalog.getBook.query({ id }).then((book: Book) => book as Book);
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
      authorImage: payload.authorImage,
      rating: payload.rating,
      text: payload.text,
    };

    return trpc.catalog.createReview.mutate(normalizedPayload);
  },
};

export function getCategoryTags(categoryId: ID, limit?: number): Promise<string[]> {
  return trpc.catalog.listCategoryTags.query({ categoryId, limit });
}
