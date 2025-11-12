import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import type { Book as CatalogBook, Category, ID, Review } from './types.js';
import { sortBooks, type BookSort } from '../utils/sortBooks.js';
import { appDataSource, initializeDataSource } from '../utils/data-source.js';
import { Book as BookEntity } from '../entities/Book.js';
import { suiClient } from '../services/walrus-storage.js';
import { formatCategoryTitle } from '../utils/categories.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const CATEGORY_EMOJIS: Record<string, string | undefined> = {
  technology: '💻',
  fiction: '📚',
  productivity: '⚡',
  wellness: '🧘',
};

const coverCache = new Map<string, string>();
const reviews: Review[] = [];

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

function getPublishedAt(entity: BookEntity): string | undefined {
  const date = entity.publishedAt ?? entity.createdAt ?? null;
  return date ? new Date(date).toISOString() : undefined;
}

function ensureArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

async function getBookRepository(): Promise<Repository<BookEntity>> {
  await initializeDataSource();
  return appDataSource.getRepository(BookEntity);
}

async function fetchCoverUrl(entity: BookEntity): Promise<string> {
  if (entity.coverWalrusBlobId) {
    const cached = coverCache.get(entity.coverWalrusBlobId);
    if (cached) {
      return cached;
    }

    try {
      const blob = await suiClient.walrus.getBlob({ blobId: entity.coverWalrusBlobId });
      const file = blob.asFile();
      const bytes = await file.bytes();
      const mimeType = entity.coverMimeType ?? 'application/octet-stream';
      const dataUrl = `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
      coverCache.set(entity.coverWalrusBlobId, dataUrl);
      return dataUrl;
    } catch (error) {
      // Swallow Walrus failures and fall back to an empty cover URL.
    }
  }

  return '';
}

function matchesSearch(entity: BookEntity, search?: string): boolean {
  if (!search) {
    return true;
  }

  const normalized = normalize(search);
  const candidates = [entity.title, entity.author].filter((candidate): candidate is string =>
    typeof candidate === 'string',
  );

  return candidates.some((candidate) => normalize(candidate).includes(normalized));
}

function matchesTags(entity: BookEntity, tags?: string[]): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }

  const entityTags = ensureArray(entity.tags);
  return tags.every((tag) => entityTags.includes(tag));
}

async function mapEntityToBook(entity: BookEntity): Promise<CatalogBook> {
  const coverUrl = await fetchCoverUrl(entity);

  return {
    id: entity.id,
    title: entity.title,
    authors: entity.author ? [entity.author] : [],
    categories: ensureArray(entity.categories),
    coverUrl,
    description: entity.description,
    priceStars: entity.priceStars ?? 0,
    rating: {
      average: entity.ratingAverage ?? 0,
      votes: entity.ratingVotes ?? 0,
    },
    tags: ensureArray(entity.tags),
    publishedAt: getPublishedAt(entity),
    reviewsCount: entity.reviewsCount ?? 0,
    walrusBlobId: entity.walrusBlobId,
    walrusBlobUrl: entity.walrusBlobUrl,
    coverWalrusBlobId: entity.coverWalrusBlobId,
    coverMimeType: entity.coverMimeType,
  } satisfies CatalogBook;
}

function sortEntities(entities: BookEntity[], sort: BookSort): BookEntity[] {
  const sortable = entities.map((entity) => ({
    entity,
    reviewsCount: entity.reviewsCount ?? 0,
    rating: {
      average: entity.ratingAverage ?? 0,
      votes: entity.ratingVotes ?? 0,
    },
    publishedAt: getPublishedAt(entity),
  }));

  const sorted = sortBooks(sortable, sort);
  return sorted.map((item) => item.entity);
}

export async function listCategories(search?: string): Promise<Category[]> {
  const repository = await getBookRepository();
  const entities = await repository.find({ select: ['categories'] });

  const counts = new Map<string, number>();
  for (const entity of entities) {
    const categories = ensureArray(entity.categories);
    for (const categoryId of categories) {
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }
  }

  const categories: Category[] = Array.from(counts.entries())
    .map(([id, count]) => ({
      id,
      slug: id,
      title: formatCategoryTitle(id),
      emoji: CATEGORY_EMOJIS[id],
      booksCount: count,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  if (!search) {
    return categories;
  }

  const normalized = normalize(search);
  return categories.filter((category) =>
    normalize(category.title).includes(normalized) || normalize(category.slug).includes(normalized),
  );
}

export async function listBooks(params: {
  categoryId?: ID;
  search?: string;
  sort?: BookSort;
  tags?: string[];
  cursor?: string;
  limit?: number;
} = {}): Promise<{ items: CatalogBook[]; nextCursor?: string }> {
  const repository = await getBookRepository();
  const entities = await repository.find();

  const filtered = entities.filter((entity) => {
    const categories = ensureArray(entity.categories);
    const categoryMatch = params.categoryId ? categories.includes(params.categoryId) : true;
    return categoryMatch && matchesSearch(entity, params.search) && matchesTags(entity, params.tags);
  });

  const sort = params.sort ?? 'popular';
  const sorted = sortEntities(filtered, sort);

  const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
  const start = cursorToIndex(params.cursor);
  const end = start + limit;
  const slice = sorted.slice(start, end);
  const items = await Promise.all(slice.map((entity) => mapEntityToBook(entity)));
  const nextCursor = end < sorted.length ? indexToCursor(end) : undefined;

  return { items, nextCursor };
}

export async function getBook(bookId: ID): Promise<CatalogBook | null> {
  const repository = await getBookRepository();
  const entity = await repository.findOne({ where: { id: bookId } });
  if (!entity) {
    return null;
  }

  return mapEntityToBook(entity);
}

export async function listAllBooks(): Promise<CatalogBook[]> {
  const repository = await getBookRepository();
  const entities = await repository.find({ order: { title: 'ASC' } });
  return Promise.all(entities.map((entity) => mapEntityToBook(entity)));
}

export async function listCategoryTags(categoryId: ID, limit = 9): Promise<string[]> {
  const repository = await getBookRepository();
  const entities = await repository.find();
  const frequency = new Map<string, number>();

  for (const entity of entities) {
    const categories = ensureArray(entity.categories);
    if (!categories.includes(categoryId)) {
      continue;
    }

    for (const tag of ensureArray(entity.tags)) {
      frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export async function listReviews(
  bookId: ID,
  params: { cursor?: string; limit?: number } = {},
): Promise<{ items: Review[]; nextCursor?: string }> {
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

async function incrementReviewCount(bookId: ID): Promise<void> {
  const repository = await getBookRepository();
  await repository.increment({ id: bookId }, 'reviewsCount', 1);
}

export async function createReview(
  bookId: ID,
  params: { authorName: string; rating: number; text: string },
): Promise<Review> {
  const book = await getBook(bookId);
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
  await incrementReviewCount(bookId);

  return review;
}

export async function createBookMetadata(): Promise<never> {
  throw new Error('Admin metadata operations are not supported for database-backed catalog');
}

export async function updateBookMetadata(): Promise<never> {
  throw new Error('Admin metadata operations are not supported for database-backed catalog');
}

export async function deleteBookMetadata(): Promise<never> {
  throw new Error('Admin metadata operations are not supported for database-backed catalog');
}
