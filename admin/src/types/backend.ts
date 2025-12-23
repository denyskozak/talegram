export type AppRouter = any;

export type ID = string;

export type Category = {
  id: ID;
  title: string;
  slug: string;
  emoji?: string;
  booksCount: number;
};

export type Book = {
  id: ID;
  title: string;
  authors: string[];
  categories: ID | null;
  coverUrl: string;
  description: string;
  price: number;
  currency?: string;
  rating: {
    average: number;
    votes: number;
  };
  tags: string[];
  similarBooks: string[];
  publishedAt?: string;
  reviewsCount: number;
  filePath?: string | null;
  coverFilePath?: string | null;
  coverMimeType?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileEncryptionIv?: string | null;
  fileEncryptionTag?: string | null;
  globalCategory?: string | null;
};
