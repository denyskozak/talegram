import type { Category } from "@/entities/category/types";

export type ID = string;

export type Book = {
  id: ID;
  title: string;
  authors: string[];
  categories: ID | null;
  coverUrl: string;
  coverImageData?: string | null;
  description: string;
  priceStars: number;
  rating: {
    average: number;
    votes: number;
  };
  tags: string[];
  publishedAt?: string;
  reviewsCount: number;
  walrusBlobId?: string;
  walrusFileId?: string | null;
  audiobookWalrusBlobId?: string | null;
  audiobookWalrusFileId?: string | null;
  coverWalrusBlobId?: string | null;
  coverWalrusFileId?: string | null;
  coverMimeType?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  audiobookMimeType?: string | null;
  audiobookFileName?: string | null;
  audiobookFileSize?: number | null;
  bookFileURL?: string | null;
  globalCategory?: string | null;
};

export type Review = {
  id: ID;
  bookId: ID;
  authorName: string;
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
  }): Promise<{ items: Book[]; nextCursor?: string }>;
  getBook(id: ID): Promise<Book>;
  listReviews(bookId: ID, cursor?: string, limit?: number): Promise<{ items: Review[]; nextCursor?: string }>;
  createReview(payload: { bookId: ID; authorName: string; rating: number; text: string }): Promise<Review>;
}
