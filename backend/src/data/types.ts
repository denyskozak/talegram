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
  fileEncryptionIv?: string | null;
  fileEncryptionTag?: string | null;
  audiobookFileEncryptionIv?: string | null;
  audiobookFileEncryptionTag?: string | null;
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
