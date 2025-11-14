import { randomUUID } from 'node:crypto';
import type { Repository } from 'typeorm';
import type { Book as CatalogBook, Category, ID, Review } from './types.js';
import { sortBooks, type BookSort } from '../utils/sortBooks.js';
import { appDataSource, initializeDataSource } from '../utils/data-source.js';
import { Book as BookEntity } from '../entities/Book.js';
import { formatCategoryTitle } from '../utils/categories.js';
import { BookProposal } from '../entities/BookProposal.js';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const CATEGORY_EMOJIS: Record<string, string | undefined> = {
  technology: '💻',
  fiction: '📚',
  productivity: '⚡',
  wellness: '🧘',
};

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

async function getBookProposalRepository(): Promise<Repository<BookProposal>> {
  await initializeDataSource();
  return appDataSource.getRepository(BookProposal);
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

function normalizeGlobalCategory(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLocaleLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.startsWith('article')) {
    return 'article';
  }

  if (normalized.startsWith('book')) {
    return 'book';
  }

  if (normalized.startsWith('comic')) {
    return 'comics';
  }

  return normalized;
}

async function mapEntityToBook(entity: BookEntity): Promise<CatalogBook> {
  return {
    id: entity.id,
    title: entity.title,
    authors: entity.author ? [entity.author] : [],
    categories: ensureArray(entity.categories),
    coverUrl: '',
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
    walrusFileId: entity.walrusFileId ?? null,
    coverWalrusBlobId: entity.coverWalrusBlobId,
    coverWalrusFileId: entity.coverWalrusFileId ?? null,
    coverMimeType: entity.coverMimeType,
    mimeType: entity.mimeType ?? null,
    fileName: entity.fileName ?? null,
    fileEncryptionIv: entity.fileEncryptionIv ?? null,
    fileEncryptionTag: entity.fileEncryptionTag ?? null,
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

export async function listCategories(params: {
  search?: string;
  globalCategory?: string;
} = {}): Promise<Category[]> {
  const repository = await getBookRepository();
  const entities = await repository.find({ relations: { proposal: true } });

  const normalizedGlobalCategory = normalizeGlobalCategory(params.globalCategory);
  const filteredByGlobalCategory = normalizedGlobalCategory
    ? entities.filter((entity) =>
        normalizeGlobalCategory(entity.proposal?.globalCategory) === normalizedGlobalCategory,
      )
    : entities;

  const counts = new Map<string, number>();
  for (const entity of filteredByGlobalCategory) {
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

  if (!params.search) {
    return categories;
  }

  const normalized = normalize(params.search);
  return categories.filter((category) =>
    normalize(category.title).includes(normalized) || normalize(category.slug).includes(normalized),
  );
}

export async function listGlobalCategories(): Promise<string[]> {
  const repository = await getBookProposalRepository();
  const proposals = await repository.find({ select: ['globalCategory'] });

  const unique = new Set(
    proposals
      .map((proposal) => proposal.globalCategory?.trim().toLocaleLowerCase())
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );

  const preferredOrder = ['article', 'book', 'comic'];

  return Array.from(unique).sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) {
      return 1;
    }
    if (indexB === -1) {
      return -1;
    }

    return indexA - indexB;
  });
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
