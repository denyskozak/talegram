import { trpc } from "@/shared/api/trpc";
import { isGlobalCategory, toGlobalCategory, type GlobalCategory } from "@/shared/constants/globalCategories";

import type { Book, CatalogApi, ID } from "./types";
import type {
  CreateReviewPayload,
  ListBooksPayload,
  ListCategoriesPayload,
  ListReviewsPayload,
} from "./apiContracts";

type RawBook = Omit<Book, "globalCategory"> & { globalCategory?: string | null };

function normalizeBook(book: RawBook): Book {
  return {
    ...book,
    globalCategory: toGlobalCategory(book.globalCategory),
  };
}

export const catalogApi: CatalogApi = {
  listCategories(query) {
    if (!query) {
      return trpc.catalog.listCategories.query(undefined);
    }

    const payload: ListCategoriesPayload = {};

    if (query.search) {
      payload.search = query.search;
    }

    if (query.globalCategory && isGlobalCategory(query.globalCategory)) {
      payload.globalCategory = query.globalCategory;
    }

    return trpc.catalog.listCategories.query(payload);
  },
  listGlobalCategories() {
    return trpc.catalog.listGlobalCategories.query().then((items) =>
      items
        .map((item) => toGlobalCategory(item))
        .filter((item): item is GlobalCategory => item !== null),
    );
  },
  listBooks(params) {
    return trpc.catalog.listBooks.query(params satisfies ListBooksPayload).then((response) => ({
      ...response,
      items: response.items.map((item) => normalizeBook(item as RawBook)),
    }));
  },
  getBook(id, params) {
    return trpc.catalog.getBook
      .query({ id, telegramUserId: params?.telegramUserId })
      .then((book) => normalizeBook(book as RawBook));
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

