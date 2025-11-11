import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  createBookMetadata,
  deleteBookMetadata,
  getBook,
  listAllBooks,
  updateBookMetadata,
} from '../data/catalog.js';
import { createRouter, procedure } from '../trpc/trpc.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const adminProcedure = procedure.use(({ ctx, next }) => {
  const header = normalizeHeader(ctx.req.headers['x-admin-secret']);
  if (header !== ADMIN_PASSWORD) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid admin credentials' });
  }

  return next();
});

const ratingSchema = z.object({
  average: z.number().min(0).max(5),
  votes: z.number().int().min(0),
});

const baseBookSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  authors: z.array(z.string().trim().min(1)).min(1),
  categories: z.array(z.string().trim().min(1)).min(1),
  coverUrl: z.string().trim().url(),
  description: z.string().trim().min(1),
  priceStars: z.number().int().min(0).max(10),
  rating: ratingSchema,
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  publishedAt: z.string().trim().datetime({ offset: true }).optional(),
  reviewsCount: z.number().int().min(0).optional(),
});

const loginInput = z.object({
  password: z.string().min(1),
});

const getBookInput = z.object({
  id: z.string().trim().min(1),
});

const createBookInput = baseBookSchema;

const updateBookInput = z.object({
  id: z.string().trim().min(1),
  patch: baseBookSchema.omit({ id: true }).partial(),
});

const deleteBookInput = z.object({
  id: z.string().trim().min(1),
});

export const adminRouter = createRouter({
  login: procedure.input(loginInput).mutation(({ input }) => {
    if (input.password !== ADMIN_PASSWORD) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid admin credentials' });
    }

    return { success: true } as const;
  }),
  listBooks: adminProcedure.query(() => listAllBooks()),
  getBook: adminProcedure.input(getBookInput).query(({ input }) => {
    const book = getBook(input.id);
    if (!book) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    return book;
  }),
  createBook: adminProcedure.input(createBookInput).mutation(({ input }) =>
    createBookMetadata({
      ...input,
      tags: input.tags ?? [],
      reviewsCount: input.reviewsCount ?? 0,
    }),
  ),
  updateBook: adminProcedure.input(updateBookInput).mutation(({ input }) =>
    updateBookMetadata(input.id, input.patch),
  ),
  deleteBook: adminProcedure.input(deleteBookInput).mutation(({ input }) => {
    deleteBookMetadata(input.id);
    return { success: true } as const;
  }),
});

