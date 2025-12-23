import {randomUUID} from 'node:crypto';
import {In, type Repository} from 'typeorm';
import type {Book as CatalogBook, Category, ID, Review} from './types.js';
import {sortBooks, type BookSort} from '../utils/sortBooks.js';
import {appDataSource, initializeDataSource} from '../utils/data-source.js';
import {Book, Book as BookEntity} from '../entities/Book.js';
import {formatCategoryTitle} from '../utils/categories.js';
import {BookProposal} from '../entities/BookProposal.js';
import {AudioBook} from '../entities/AudioBook.js';

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

function splitAuthors(value: string | null | undefined): string[] {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return [];
    }

    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function getCategoryId(entity: BookEntity): string | null {
    const raw = entity.category;
    if (typeof raw !== 'string') {
        return null;
    }

    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
}

async function getBookRepository(): Promise<Repository<BookEntity>> {
    await initializeDataSource();
    return appDataSource.getRepository(BookEntity);
}

async function getBookProposalRepository(): Promise<Repository<BookProposal>> {
    await initializeDataSource();
    return appDataSource.getRepository(BookProposal);
}

async function getAudioBookRepository(): Promise<Repository<AudioBook>> {
    await initializeDataSource();
    return appDataSource.getRepository(AudioBook);
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

function normalizeLanguage(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim().toLocaleLowerCase();
    return normalized.length > 0 ? normalized : null;
}

async function mapEntityToBook(entity: BookEntity): Promise<CatalogBook> {
    const audioBookRepository = await getAudioBookRepository();
    const audioBooks = await audioBookRepository.find({where: {bookId: entity.id}});
    const ratingAverage = entity.middleRate ?? entity.ratingAverage ?? 0;
    const ratingVotes = entity.ratingVotes ?? 0;
    return {
        id: entity.id,
        title: entity.title,
        authors: splitAuthors(entity.author),
        categories: getCategoryId(entity),
        coverUrl: entity.coverUrl ?? '',
        description: entity.description,
        price: entity.price ?? 0,
        rating: {
            average: ratingAverage,
            votes: ratingVotes,
        },
        currency: entity.currency,
        tags: ensureArray(entity.tags),
        similarBooks: ensureArray(entity.similarBooks),
        publishedAt: getPublishedAt(entity),
        reviewsCount: entity.reviewsCount ?? 0,
        filePath: entity.filePath ?? null,
        audiobookFilePath: entity.audiobookFilePath ?? null,
        coverFilePath: entity.coverFilePath ?? null,
        coverMimeType: entity.coverMimeType,
        mimeType: entity.mimeType ?? null,
        fileName: entity.fileName ?? null,
        audiobookMimeType: entity.audiobookMimeType ?? null,
        audiobookFileName: entity.audiobookFileName ?? null,
        audiobookFileSize: entity.audiobookFileSize ?? null,
        globalCategory: entity.globalCategory ?? null,
        authorTelegramUserId: entity.authorTelegramUserId ?? null,
        language: entity.language ?? null,
        audioBooks: audioBooks.map((audioBook) => ({
            id: audioBook.id,
            bookId: audioBook.bookId,
            title: audioBook.title ?? null,
            mimeType: audioBook.mimeType ?? null,
            fileName: audioBook.fileName ?? null,
            fileSize: audioBook.fileSize ?? null,
        })),
    } satisfies CatalogBook;
}

function sortEntities(entities: BookEntity[], sort: BookSort): BookEntity[] {
    const sortable = entities.map((entity) => ({
        entity,
        reviewsCount: entity.reviewsCount ?? 0,
        rating: {
            average: entity.middleRate ?? entity.ratingAverage ?? 0,
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
    language?: string;
} = {}): Promise<Category[]> {
    const repository = await getBookRepository();
    const normalizedGlobalCategory = normalizeGlobalCategory(params.globalCategory);
    const normalizedLanguage = normalizeLanguage(params.language);
    const queryBuilder = repository.createQueryBuilder('book');

    if (normalizedGlobalCategory) {
        queryBuilder.andWhere(
            'LOWER(book.global_category) = :globalCategory',
            {globalCategory: normalizedGlobalCategory},
        );
    }

    if (normalizedLanguage) {
        queryBuilder.andWhere('LOWER(book.language) = :language', {language: normalizedLanguage});
    }

    const filteredByGlobalCategory = await queryBuilder.getMany();

    const counts = new Map<string, number>();
    for (const entity of filteredByGlobalCategory) {
        const categoryId = getCategoryId(entity);
        if (!categoryId) {
            continue;
        }

        counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
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
    const proposals = await repository.find({select: ['globalCategory']});

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
    language?: string;
} = {}): Promise<{ items: CatalogBook[]; nextCursor?: string }> {
    const repository = await getBookRepository();
    const entities = await repository.find();

    const normalizedLanguage =
        typeof params.language === 'string' && params.language.trim().length > 0
            ? params.language.trim().toLocaleLowerCase()
            : null;

    const filtered = entities.filter((entity) => {
        const categoryId = getCategoryId(entity);
        const categoryMatch = params.categoryId ? categoryId === params.categoryId : true;
        const languageMatch = normalizedLanguage
            ? (entity.language ?? '').trim().toLocaleLowerCase() === normalizedLanguage
            : true;

        return (
            categoryMatch &&
            languageMatch &&
            (matchesSearch(entity, params.search) ||
                matchesTags(entity, params.tags))
        );
    });

    const sort = params.sort ?? 'popular';
    const sorted = sortEntities(filtered, sort);

    const limit = Math.max(1, Math.min(params.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
    const start = cursorToIndex(params.cursor);
    const end = start + limit;
    const slice = sorted.slice(start, end);
    const items = await Promise.all(slice.map((entity) => mapEntityToBook(entity)));
    const nextCursor = end < sorted.length ? indexToCursor(end) : undefined;

    return {items, nextCursor};
}

export async function getBook(bookId: ID): Promise<CatalogBook | null> {
    const repository = await getBookRepository();
    const entity = await repository.findOne({where: {id: bookId}});
    if (!entity) {
        return null;
    }

    return mapEntityToBook(entity);
}

export async function listAllBooks(): Promise<CatalogBook[]> {
    const repository = await getBookRepository();
    const entities = await repository.find({order: {title: 'ASC'}});
    return Promise.all(entities.map((entity) => mapEntityToBook(entity)));
}

export async function listAudiobooks(language: string): Promise<CatalogBook[]> {
    const bookRepository = await getBookRepository();
    const bookEntities = await bookRepository.find({where: {language}});
    const bookIds = bookEntities.map((book) => book.id);
    const bookCatalogueEntity = await Promise.all(bookEntities.map(mapEntityToBook));

    const booksById = bookCatalogueEntity.reduce<Map<string, CatalogBook>>((store, book) => {
        store.set(book.id, book);
        return store;
    }, new Map());

    if (booksById.size === 0) {
        return [];
    }

    const audioBookRepository = await getAudioBookRepository();
    const audioBooks = await audioBookRepository.find({where: {bookId: In(bookIds)}});

    const shuffledAudioBooks = audioBooks
        .map((audioBook) => ({audioBook, sortKey: Math.random()}))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(({audioBook}) => audioBook);


    if (shuffledAudioBooks.length === 0) {
        return [];
    }

    return Promise.all(shuffledAudioBooks.map((audioBook) => ({
        ...booksById.get(audioBook.bookId)!,
        audioBooks: [audioBook]
    })));
}

export async function listCategoryTags(categoryId: ID, limit = 9): Promise<string[]> {
    const repository = await getBookRepository();
    const entities = await repository.find();
    const frequency = new Map<string, number>();

    for (const entity of entities) {
        const entityCategoryId = getCategoryId(entity);
        if (entityCategoryId !== categoryId) {
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

    return {items: slice, nextCursor};
}

async function incrementReviewCount(bookId: ID): Promise<void> {
    const repository = await getBookRepository();
    await repository.increment({id: bookId}, 'reviewsCount', 1);
}

async function updateBookRatingStats(bookId: ID, rating: number): Promise<void> {
    const repository = await getBookRepository();

    await repository.manager.transaction(async (entityManager) => {
        const bookRepository = entityManager.getRepository(BookEntity);
        const bookEntity = await bookRepository.findOne({where: {id: bookId}});
        if (!bookEntity) {
            return;
        }

        const currentVotes = bookEntity.ratingVotes ?? 0;
        const currentAverage = bookEntity.middleRate ?? bookEntity.ratingAverage ?? 0;
        const nextVotes = currentVotes + 1;
        const rawAverage = nextVotes === 0 ? 0 : (currentAverage * currentVotes + rating) / nextVotes;
        const roundedAverage = Math.round(rawAverage * 10) / 10;

        bookEntity.ratingVotes = nextVotes;
        bookEntity.ratingAverage = roundedAverage;
        bookEntity.middleRate = roundedAverage;

        await bookRepository.save(bookEntity);
    });
}

export async function createReview(
    bookId: ID,
    params: { authorName: string; authorImage?: string | null; rating: number; text: string },
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
        authorImage: params.authorImage,
        rating: normalizedRating,
        text: params.text,
        createdAt: new Date().toISOString(),
    };

    reviews.unshift(review);
    await incrementReviewCount(bookId);
    await updateBookRatingStats(bookId, normalizedRating);

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
