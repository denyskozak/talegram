import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  createReview,
  getBook,
  listBooks,
  listCategories,
  listCategoryTags,
  listGlobalCategories,
  listReviews,
} from '../data/catalog.js';
import { getPurchaseDetails } from '../stores/purchasesStore.js';
import { fetchWalrusFilesBase64 } from '../utils/walrus-files.js';

const listCategoriesInput = z.object({
  search: z.string().trim().optional(),
  globalCategory: z.enum(['article', 'book', 'comics']).optional(),
});

const listBooksInput = z.object({
  categoryId: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  sort: z.enum(['popular', 'rating', 'new']).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  cursor: z.string().trim().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const getBookInput = z.object({
  id: z.string().trim().min(1),
  telegramUserId: z.string().trim().min(1).optional(),
});

const listReviewsInput = z.object({
  bookId: z.string().trim().min(1),
  cursor: z.string().trim().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const listCategoryTagsInput = z.object({
  categoryId: z.string().trim().min(1),
  limit: z.number().int().min(1).max(20).optional(),
});

const createReviewInput = z.object({
  bookId: z.string().trim().min(1),
  authorName: z.string().trim().min(1).max(128),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1).max(2048),
});

export const catalogRouter = createRouter({
  listCategories: procedure
    .input(listCategoriesInput.optional())
    .query(({ input }) => listCategories(input ?? {})),
  listGlobalCategories: procedure.query(() => listGlobalCategories()),
  listBooks: procedure
    .input(listBooksInput.optional())
    .query(async ({ input }) => {
      const result = await listBooks(input ?? {});

      const coverWalrusFileIds = Array.from<string>(
        new Set(
          result.items
            .map((book) => book.coverWalrusFileId)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
        ),
      );
      const coverDataById =
        coverWalrusFileIds.length > 0
          ? await fetchWalrusFilesBase64(coverWalrusFileIds)
          : new Map<string, string | null>();
      const items = result.items.map((book) => {
        const { fileEncryptionIv, fileEncryptionTag, ...bookForClient } = book;
        const coverImageData =
          book.coverWalrusFileId && coverDataById.has(book.coverWalrusFileId)
            ? coverDataById.get(book.coverWalrusFileId) ?? null
            : null;

        return { ...bookForClient, coverImageData };
      });

      return { ...result, items };
    }),
  getBook: procedure.input(getBookInput).query(async ({ input }) => {
    const book = await getBook(input.id);
    if (!book) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    if (input.telegramUserId) {
      const details = await getPurchaseDetails(book.id, input.telegramUserId);
      if (details?.walrusBlobId) {
        // Preserve purchase details lookup side effect for validation purposes.
      }
    }

    const { fileEncryptionIv, fileEncryptionTag, ...bookForClient } = book;

    const coverImageData = book.coverWalrusFileId
      ? (await fetchWalrusFilesBase64([book.coverWalrusFileId])).get(book.coverWalrusFileId) ?? null
      : null;

    return { ...bookForClient, coverImageData };
  }),
  listReviews: procedure
    .input(listReviewsInput)
    .query(({ input }) => listReviews(input.bookId, input)),
  listCategoryTags: procedure
    .input(listCategoryTagsInput)
    .query(({ input }) => listCategoryTags(input.categoryId, input.limit)),
  createReview: procedure.input(createReviewInput).mutation(async ({ input }) => {
    const book = await getBook(input.bookId);
    if (!book) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    return createReview(input.bookId, {
      authorName: input.authorName,
      rating: input.rating,
      text: input.text,
    });
  }),
});

