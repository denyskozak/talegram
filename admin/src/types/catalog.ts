export type ID = string;

export type Category = {
  id: ID;
  title: string;
  slug: string;
  emoji?: string;
  booksCount: number;
};

export type AuthorSummary = {
  id: ID;
  name: string;
  telegramUsername: string;
};

export type Book = {
  id: ID;
  title: string;
  authors: string[];
  categories: ID | null;
  coverUrl: string;
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
  coverWalrusBlobId?: string | null;
  coverWalrusFileId?: string | null;
  coverMimeType?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileEncryptionIv?: string | null;
  fileEncryptionTag?: string | null;
  globalCategory?: string | null;
};

export type BookFormValues = {
  id: ID;
  title: string;
  authors: string[];
  categories: string;
  coverUrl: string;
  description: string;
  priceStars: number;
  rating: {
    average: number;
    votes: number;
  };
  tags: string[];
  publishedAt?: string;
  reviewsCount: number;
};

export type CreateAuthorPayload = {
  name: string;
  telegramUsername: string;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  expiresAt: string;
};

export type UpdateBookPayload = {
  id: ID;
  patch: Partial<Omit<BookFormValues, 'id'>>;
};

export type DeleteBookPayload = {
  id: ID;
};

export type Review = {
  id: ID;
  bookId: ID;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
};
