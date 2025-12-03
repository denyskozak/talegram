import { TRPCError } from '@trpc/server';
import { In } from 'typeorm';
import { z } from 'zod';

import { createRouter, procedure, authorizedProcedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { Author } from '../entities/Author.js';
import { Book } from '../entities/Book.js';
import { Purchase } from '../entities/Purchase.js';
import { normalizeTelegramUserId } from '../utils/telegram.js';

const getMyPublishedBookInput = z.object({
  id: z.string().trim().min(1),
});

export const authorsRouter = createRouter({
  list: procedure.query(async () => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Author);
    const authors = await repository.find({ order: { name: 'ASC' } });
    return authors.map((author) => ({
      id: author.id,
      name: author.name,
      telegramUserId: author.telegramUserId,
    }));
  }),
  myPublishedBooks: authorizedProcedure.query(async ({ ctx }) => {
    await initializeDataSource();
    const telegramUserId = normalizeTelegramUserId(ctx.telegramAuth.userId);
    if (!telegramUserId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Telegram authorization required' });
    }

    const authorRepository = appDataSource.getRepository(Author);
    const isAuthor = await authorRepository.exist({ where: { telegramUserId } });
    if (!isAuthor) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'User is not registered as an author' });
    }

    const bookRepository = appDataSource.getRepository(Book);
    const purchaseRepository = appDataSource.getRepository(Purchase);
    const books = await bookRepository.find({
      where: { authorTelegramUserId: telegramUserId },
      order: { publishedAt: 'DESC', createdAt: 'DESC' },
    });

    const bookIds = books.map((book) => book.id);
    const purchases = bookIds.length
      ? await purchaseRepository.find({
          where: { bookId: In(bookIds) },
          order: { purchasedAt: 'DESC' },
        })
      : [];

    const purchasesByBook = purchases.reduce((map, purchase) => {
      const list = map.get(purchase.bookId) ?? [];
      list.push(purchase);
      map.set(purchase.bookId, list);
      return map;
    }, new Map<string, Purchase[]>());
    return books.map((book) => ({
      id: book.id,
      title: book.title,
      price: book.price,
      currency: book.currency,
      publishedAt: book.publishedAt ? new Date(book.publishedAt).toISOString() : null,
      language: book.language ?? null,
      sales: (purchasesByBook.get(book.id) ?? []).map((purchase) => ({
        paymentId: purchase.paymentId,
        purchasedAt: new Date(purchase.purchasedAt).toISOString(),
        telegramUserId: purchase.telegramUserId,
        walrusBlobId: purchase.walrusBlobId ?? null,
        walrusFileId: purchase.walrusFileId ?? null,
      })),
    }));
  }),
  myPublishedBook: authorizedProcedure
    .input(getMyPublishedBookInput)
    .query(async ({ input, ctx }) => {
      await initializeDataSource();
      const telegramUserId = normalizeTelegramUserId(ctx.telegramAuth.userId);

      if (!telegramUserId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Telegram authorization required' });
      }

      const authorRepository = appDataSource.getRepository(Author);
      const isAuthor = await authorRepository.exist({ where: { telegramUserId } });
      if (!isAuthor) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'User is not registered as an author' });
      }

      const bookRepository = appDataSource.getRepository(Book);
      const purchaseRepository = appDataSource.getRepository(Purchase);

      const book = await bookRepository.findOne({ where: { id: input.id, authorTelegramUserId: telegramUserId } });
      if (!book) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
      }

      const purchases = await purchaseRepository.find({
        where: { bookId: book.id },
        order: { purchasedAt: 'DESC' },
      });

      const totalEarnings = purchases.reduce((sum) => sum + book.price, 0);

      return {
        id: book.id,
        title: book.title,
        price: book.price,
        currency: book.currency,
        publishedAt: book.publishedAt ? new Date(book.publishedAt).toISOString() : null,
        language: book.language ?? null,
        sales: purchases.map((purchase) => ({
          paymentId: purchase.paymentId,
          purchasedAt: new Date(purchase.purchasedAt).toISOString(),
          telegramUserId: purchase.telegramUserId,
          walrusBlobId: purchase.walrusBlobId ?? null,
          walrusFileId: purchase.walrusFileId ?? null,
        })),
        earnings: {
          total: totalEarnings,
          currency: book.currency,
        },
      };
    }),
});
