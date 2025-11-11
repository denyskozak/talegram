import { randomUUID } from 'crypto';
import type { Book, Category, ID, Review } from './types.js';
import { sortBooks, type BookSort } from '../utils/sortBooks.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const baseCategories: Array<Omit<Category, 'booksCount'>> = [
  { id: 'technology', title: 'Technology & Programming', slug: 'technology', emoji: '💻' },
  { id: 'fiction', title: 'Modern Fiction', slug: 'fiction', emoji: '📚' },
  { id: 'productivity', title: 'Productivity & Mindset', slug: 'productivity', emoji: '⚡' },
  { id: 'wellness', title: 'Wellness & Mindfulness', slug: 'wellness', emoji: '🧘' },
];

type BookSeed = Omit<Book, 'reviewsCount'> & { reviewsCount?: number };

type ReviewSeed = Omit<Review, 'id'> & { id?: string };

const reviewSeeds: ReviewSeed[] = [
  {
    id: 'review-clean-code-1',
    bookId: 'clean-code',
    authorName: 'Jane Developer',
    rating: 5,
    text: 'A timeless reference that I return to before every major refactor.',
    createdAt: '2024-07-12T10:00:00.000Z',
  },
  {
    id: 'review-clean-code-2',
    bookId: 'clean-code',
    authorName: 'Michael P.',
    rating: 4,
    text: 'Great principles with actionable examples. Some chapters feel dated, but still essential.',
    createdAt: '2024-07-02T18:30:00.000Z',
  },
  {
    id: 'review-pragmatic-1',
    bookId: 'pragmatic-programmer',
    authorName: 'Sergey I.',
    rating: 5,
    text: 'One of the most inspiring books for my engineering career.',
    createdAt: '2024-06-24T09:45:00.000Z',
  },
  {
    id: 'review-pragmatic-2',
    bookId: 'pragmatic-programmer',
    authorName: 'Emily H.',
    rating: 4,
    text: 'Packed with wisdom. I recommend it to every new hire on my team.',
    createdAt: '2024-06-16T15:15:00.000Z',
  },
  {
    id: 'review-deep-work-1',
    bookId: 'deep-work',
    authorName: 'Alex Productivity',
    rating: 5,
    text: 'Helped me build rituals that doubled my focus time.',
    createdAt: '2024-05-21T11:00:00.000Z',
  },
  {
    id: 'review-deep-work-2',
    bookId: 'deep-work',
    authorName: 'Linda',
    rating: 4,
    text: 'Great framework, though some examples are repetitive.',
    createdAt: '2024-05-10T08:00:00.000Z',
  },
  {
    id: 'review-atomic-habits-1',
    bookId: 'atomic-habits',
    authorName: 'Oleg',
    rating: 5,
    text: 'Practical advice that actually helped me form new habits.',
    createdAt: '2024-04-30T12:00:00.000Z',
  },
  {
    id: 'review-atomic-habits-2',
    bookId: 'atomic-habits',
    authorName: 'Gina',
    rating: 4,
    text: 'Simple ideas, brilliantly structured. I keep it on my desk.',
    createdAt: '2024-04-22T17:40:00.000Z',
  },
  {
    id: 'review-dune-1',
    bookId: 'dune',
    authorName: 'Sci-Fi Fan',
    rating: 5,
    text: 'Epic world building. The audiobook narration is stellar.',
    createdAt: '2024-03-14T21:00:00.000Z',
  },
  {
    id: 'review-hail-mary-1',
    bookId: 'project-hail-mary',
    authorName: 'Natalia',
    rating: 5,
    text: 'Could not put it down. The science puzzles are so satisfying.',
    createdAt: '2024-02-18T07:25:00.000Z',
  },
  {
    id: 'review-hail-mary-2',
    bookId: 'project-hail-mary',
    authorName: 'Ben',
    rating: 4,
    text: 'Fun and fast-paced. The friendship at the core is heartwarming.',
    createdAt: '2024-02-12T14:55:00.000Z',
  },
  {
    id: 'review-restful-mind-1',
    bookId: 'restful-mind',
    authorName: 'Daria',
    rating: 5,
    text: 'A calming read with exercises that actually fit into my schedule.',
    createdAt: '2024-01-20T06:30:00.000Z',
  },
  {
    id: 'review-restful-mind-2',
    bookId: 'restful-mind',
    authorName: 'Marcus',
    rating: 4,
    text: 'Great mix of science and mindfulness practices.',
    createdAt: '2024-01-15T19:10:00.000Z',
  },
];

const booksSeed: BookSeed[] = [
  {
    id: 'clean-code',
    title: 'Clean Code',
    authors: ['Robert C. Martin'],
    categories: ['technology'],
    coverUrl: 'https://placehold.co/320x480?text=Clean+Code',
    description: 'A handbook of agile software craftsmanship filled with best practices.',
    priceStars: 9,
    rating: { average: 4.8, votes: 3200 },
    tags: ['software', 'craftsmanship', 'agile'],
    publishedAt: '2008-08-01T00:00:00.000Z',
  },
  {
    id: 'pragmatic-programmer',
    title: 'The Pragmatic Programmer',
    authors: ['Andrew Hunt', 'David Thomas'],
    categories: ['technology'],
    coverUrl: 'https://placehold.co/320x480?text=Pragmatic+Programmer',
    description: 'Classic book about pragmatic approaches to software development.',
    priceStars: 8,
    rating: { average: 4.7, votes: 2100 },
    tags: ['software', 'career', 'craftsmanship'],
    publishedAt: '2019-09-13T00:00:00.000Z',
  },
  {
    id: 'deep-work',
    title: 'Deep Work',
    authors: ['Cal Newport'],
    categories: ['productivity'],
    coverUrl: 'https://placehold.co/320x480?text=Deep+Work',
    description: 'Rules for focused success in a distracted world.',
    priceStars: 7,
    rating: { average: 4.6, votes: 4800 },
    tags: ['focus', 'work', 'habits'],
    publishedAt: '2016-01-05T00:00:00.000Z',
  },
  {
    id: 'atomic-habits',
    title: 'Atomic Habits',
    authors: ['James Clear'],
    categories: ['productivity'],
    coverUrl: 'https://placehold.co/320x480?text=Atomic+Habits',
    description: 'An easy & proven way to build good habits and break bad ones.',
    priceStars: 6,
    rating: { average: 4.8, votes: 13200 },
    tags: ['habits', 'self-help', 'motivation'],
    publishedAt: '2018-10-16T00:00:00.000Z',
  },
  {
    id: 'dune',
    title: 'Dune',
    authors: ['Frank Herbert'],
    categories: ['fiction'],
    coverUrl: 'https://placehold.co/320x480?text=Dune',
    description: 'A science fiction saga of politics, religion, and ecology on the desert planet Arrakis.',
    priceStars: 5,
    rating: { average: 4.5, votes: 8900 },
    tags: ['science fiction', 'classic', 'epic'],
    publishedAt: '1965-08-01T00:00:00.000Z',
  },
  {
    id: 'project-hail-mary',
    title: 'Project Hail Mary',
    authors: ['Andy Weir'],
    categories: ['fiction', 'technology'],
    coverUrl: 'https://placehold.co/320x480?text=Project+Hail+Mary',
    description: 'A lone astronaut must save Earth from disaster in this modern sci-fi adventure.',
    priceStars: 7,
    rating: { average: 4.7, votes: 5400 },
    tags: ['science fiction', 'adventure', 'space'],
    publishedAt: '2021-05-04T00:00:00.000Z',
  },
  {
    id: 'restful-mind',
    title: 'The Restful Mind',
    authors: ['Gyalwa Dokhampa'],
    categories: ['wellness', 'productivity'],
    coverUrl: 'https://placehold.co/320x480?text=The+Restful+Mind',
    description: 'Practical mindfulness teachings for busy people.',
    priceStars: 5,
    rating: { average: 4.3, votes: 1600 },
    tags: ['mindfulness', 'wellness', 'meditation'],
    publishedAt: '2012-09-18T00:00:00.000Z',
  },
];

const reviews: Review[] = reviewSeeds.map((seed) => ({
  ...seed,
  id: seed.id ?? randomUUID(),
}));

const reviewCountByBook = reviews.reduce<Record<ID, number>>((acc, review) => {
  acc[review.bookId] = (acc[review.bookId] ?? 0) + 1;
  return acc;
}, {});

const books: Book[] = booksSeed.map((seed) => ({
  ...seed,
  reviewsCount: seed.reviewsCount ?? reviewCountByBook[seed.id] ?? 0,
}));

const categories: Category[] = baseCategories.map((category) => ({
  ...category,
  booksCount: books.filter((book) => book.categories.includes(category.id)).length,
}));

function sanitizeStringArray(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function recalculateCategoryCounts(): void {
  for (const category of categories) {
    category.booksCount = 0;
  }

  for (const book of books) {
    for (const categoryId of book.categories) {
      const category = categories.find((entry) => entry.id === categoryId);
      if (category) {
        category.booksCount += 1;
      }
    }
  }
}

function ensureCategoriesExist(categoryIds: ID[]): void {
  for (const categoryId of categoryIds) {
    if (!categories.some((category) => category.id === categoryId)) {
      throw new Error(`Unknown category: ${categoryId}`);
    }
  }
}

function cloneBook(book: Book): Book {
  return {
    ...book,
    authors: [...book.authors],
    categories: [...book.categories],
    rating: { ...book.rating },
    tags: [...book.tags],
  };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function cursorToIndex(cursor?: string): number {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function indexToCursor(index: number): string {
  return index.toString(10);
}

function matchesSearch(book: Book, search?: string): boolean {
  if (!search) {
    return true;
  }

  const normalized = normalize(search);
  return [book.title, ...book.authors].some((candidate) => normalize(candidate).includes(normalized));
}

function matchesTags(book: Book, tags?: string[]): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }

  return tags.every((tag) => book.tags.includes(tag));
}

function filterBooks(source: Book[], params: { categoryId?: ID; search?: string; tags?: string[] }): Book[] {
  return source.filter((book) => {
    const categoryMatch = params.categoryId ? book.categories.includes(params.categoryId) : true;
    return categoryMatch && matchesSearch(book, params.search) && matchesTags(book, params.tags);
  });
}

export function listCategories(search?: string): Category[] {
  if (!search) {
    return categories;
  }

  const normalized = normalize(search);
  return categories.filter((category) =>
    normalize(category.title).includes(normalized) || normalize(category.slug).includes(normalized),
  );
}

export function listBooks(params: {
  categoryId?: ID;
  search?: string;
  sort?: BookSort;
  tags?: string[];
  cursor?: string;
  limit?: number;
}): { items: Book[]; nextCursor?: string } {
  const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
  const filtered = filterBooks(books, params);
  const sorted = sortBooks(filtered, params.sort ?? 'popular');
  const start = cursorToIndex(params.cursor);
  const end = start + limit;
  const slice = sorted.slice(start, end);
  const nextCursor = end < sorted.length ? indexToCursor(end) : undefined;

  return { items: slice, nextCursor };
}

export function getBook(bookId: ID): Book | undefined {
  return books.find((book) => book.id === bookId);
}

export function listAllBooks(): Book[] {
  return books
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((book) => cloneBook(book));
}

export function createBookMetadata(
  params: Omit<Book, 'reviewsCount'> & { reviewsCount?: number },
): Book {
  if (books.some((book) => book.id === params.id)) {
    throw new Error('Book with this id already exists');
  }

  ensureCategoriesExist(params.categories);

  const book: Book = {
    ...params,
    authors: sanitizeStringArray(params.authors),
    categories: sanitizeStringArray(params.categories),
    tags: sanitizeStringArray(params.tags),
    reviewsCount: params.reviewsCount ?? 0,
    priceStars: Math.round(clamp(params.priceStars, 0, 10)),
    rating: {
      average: clamp(params.rating.average, 0, 5),
      votes: Math.max(0, Math.round(params.rating.votes)),
    },
  };

  books.push(book);
  recalculateCategoryCounts();

  return cloneBook(book);
}

export function updateBookMetadata(
  bookId: ID,
  patch: Partial<Omit<Book, 'id'>>,
): Book {
  const book = books.find((entry) => entry.id === bookId);
  if (!book) {
    throw new Error('Book not found');
  }

  if (patch.categories) {
    ensureCategoriesExist(patch.categories);
  }

  if (patch.title !== undefined) {
    book.title = patch.title;
  }

  if (patch.authors) {
    book.authors = sanitizeStringArray(patch.authors);
  }

  if (patch.categories) {
    book.categories = sanitizeStringArray(patch.categories);
  }

  if (patch.coverUrl !== undefined) {
    book.coverUrl = patch.coverUrl;
  }

  if (patch.description !== undefined) {
    book.description = patch.description;
  }

  if (patch.priceStars !== undefined) {
    book.priceStars = Math.round(clamp(patch.priceStars, 0, 10));
  }

  if (patch.rating) {
    book.rating = {
      average: clamp(patch.rating.average, 0, 5),
      votes: Math.max(0, Math.round(patch.rating.votes)),
    };
  }

  if (patch.tags) {
    book.tags = sanitizeStringArray(patch.tags);
  }

  if (patch.publishedAt !== undefined) {
    book.publishedAt = patch.publishedAt;
  }

  if (patch.reviewsCount !== undefined) {
    book.reviewsCount = Math.max(0, Math.round(patch.reviewsCount));
  }

  recalculateCategoryCounts();

  return cloneBook(book);
}

export function deleteBookMetadata(bookId: ID): void {
  const index = books.findIndex((book) => book.id === bookId);
  if (index === -1) {
    throw new Error('Book not found');
  }

  books.splice(index, 1);

  for (let i = reviews.length - 1; i >= 0; i -= 1) {
    if (reviews[i]?.bookId === bookId) {
      reviews.splice(i, 1);
    }
  }

  recalculateCategoryCounts();
}

export function listReviews(
  bookId: ID,
  params: { cursor?: string; limit?: number } = {},
): { items: Review[]; nextCursor?: string } {
  const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
  const related = reviews
    .filter((review) => review.bookId === bookId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const start = cursorToIndex(params.cursor);
  const end = start + limit;
  const slice = related.slice(start, end);
  const nextCursor = end < related.length ? indexToCursor(end) : undefined;

  return { items: slice, nextCursor };
}

export function createReview(
  bookId: ID,
  params: { authorName: string; rating: number; text: string },
): Review {
  const book = books.find((entry) => entry.id === bookId);
  if (!book) {
    throw new Error('Book not found');
  }

  const normalizedRating = Math.max(1, Math.min(5, Math.round(params.rating)));
  const review: Review = {
    id: randomUUID(),
    bookId,
    authorName: params.authorName,
    rating: normalizedRating,
    text: params.text,
    createdAt: new Date().toISOString(),
  };

  reviews.unshift(review);
  book.reviewsCount += 1;

  return review;
}

export function listCategoryTags(categoryId: ID, limit = 9): string[] {
  const relatedBooks = books.filter((book) => book.categories.includes(categoryId));
  const tagFrequency = new Map<string, number>();

  for (const book of relatedBooks) {
    for (const tag of book.tags) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagFrequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}
