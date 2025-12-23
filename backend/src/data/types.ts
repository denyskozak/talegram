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
    currency: string;
  rating: {
    average: number;
    votes: number;
  };
  tags: string[];
  similarBooks?: string[];
  publishedAt?: string;
  reviewsCount: number;
  filePath?: string | null;
  audiobookFilePath?: string | null;
  coverFilePath?: string | null;
  coverMimeType?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  audiobookMimeType?: string | null;
  audiobookFileName?: string | null;
  audiobookFileSize?: number | null;
  globalCategory?: string | null;
  authorTelegramUserId?: string | null;
  language?: string | null;
  audioBooks?: {
    id: string;
    bookId: string;
    title: string | null;
    filePath: string;
    mimeType: string | null;
    fileName: string | null;
    fileSize: number | null;
  }[];
};

export type Review = {
  id: ID;
  bookId: ID;
  authorName: string;
  authorImage?: string | null;
  rating: number;
  text: string;
  createdAt: string;
};
