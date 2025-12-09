import type { Category } from "@/entities/category/types";
import {trpc} from "@/shared/api/trpc.ts";

export type ID = string;

export type Book = Awaited<ReturnType<typeof trpc.catalog.getBook.query>>;

export type Review = {
  id: ID;
  bookId: ID;
  authorName: string;
  authorImage?: string | null;
  rating: number;
  text: string;
  createdAt: string;
};

export interface CatalogApi {
  listCategories(query?: { search?: string; globalCategory?: string }): Promise<Category[]>;
  listGlobalCategories(): Promise<string[]>;
  listBooks(params: {
    categoryId?: ID;
    search?: string;
    sort?: "popular" | "rating" | "new";
    tags?: string[];
    cursor?: string;
    limit?: number;
    language?: string;
  }): Promise<{ items: Book[]; nextCursor?: string }>;
  getBook(id: ID): Promise<Book>;
  listReviews(bookId: ID, cursor?: string, limit?: number): Promise<{ items: Review[]; nextCursor?: string }>;
  createReview(payload: {
    bookId: ID;
    authorName: string;
    authorImage?: string | null;
    rating: number;
    text: string;
  }): Promise<Review>;
}
