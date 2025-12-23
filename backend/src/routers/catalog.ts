import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  createReview,
  getBook,
  listBooks,
  listAudiobooks,
  listCategories,
  listCategoryTags,
  listGlobalCategories,
  listReviews,
} from '../data/catalog.js';
import { getPurchaseDetails } from '../stores/purchasesStore.js';

const listCategoriesInput = z.object({
  search: z.string().trim().optional(),
  globalCategory: z.enum(['article', 'book', 'comics']).optional(),
  language: z.string().trim().min(1).optional(),
});

const listBooksInput = z.object({
  categoryId: z.string().trim().min(1).optional(),
  search: z.string().trim().optional(),
  sort: z.enum(['popular', 'rating', 'new']).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  cursor: z.string().trim().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  language: z.string().trim().min(1).optional(),
});

const getBookInput = z.object({
  id: z.string().trim().min(1),
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
  authorImage: z.string().trim().url().nullish(),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().max(2048),
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

      const items = result.items.map((book) => ({ ...book }));

      return { ...result, items };
    }),
  getBook: procedure.input(getBookInput).query(async ({ input, ctx }) => {
    const book = await getBook(input.id);
    if (!book) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    if (ctx.telegramAuth.userId) {
      const details = await getPurchaseDetails(book.id, ctx.telegramAuth.userId);
      if (details?.filePath) {
        // Preserve purchase details lookup side effect for validation purposes.
      }
    }

    return book;
  }),
  listAudiobooks: procedure.query(() => listAudiobooks()),
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
      authorImage: input.authorImage,
      rating: input.rating,
      text: input.text,
    });
  }),
});
