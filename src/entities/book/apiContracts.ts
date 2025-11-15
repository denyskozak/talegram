import type { GlobalCategory } from "@/shared/constants/globalCategories";
import type { ID } from "./types";

export type ListCategoriesPayload = {
  search?: string;
  globalCategory?: GlobalCategory;
};

export type ListBooksPayload = {
  categoryId?: ID;
  search?: string;
  sort?: "popular" | "rating" | "new";
  tags?: string[];
  cursor?: string;
  limit?: number;
};

export type ListReviewsPayload = {
  bookId: ID;
  cursor?: string;
  limit?: number;
};

export type CreateReviewPayload = {
  bookId: ID;
  authorName: string;
  rating: number;
  text: string;
};
