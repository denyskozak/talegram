import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { authorizedProcedure, createRouter } from '../trpc/trpc.js';
import {
  getPurchaseDetails,
  listPurchasedBooks,
  setPurchased,
} from '../stores/purchasesStore.js';
import { getBook } from '../data/catalog.js';
import { fetchStarsInvoiceStatus, markInvoiceAsFailed } from '../services/telegram-payments.js';

const bookIdInput = z.object({
  bookId: z.string().trim().min(1),
});

const purchaseStatusInput = bookIdInput;

const confirmPurchaseInput = purchaseStatusInput.extend({
  paymentId: z.string().trim().min(1),
});

export const purchasesRouter = createRouter({
  getStatus: authorizedProcedure.input(purchaseStatusInput).query(async ({ input, ctx }) => {
    const telegramUserId = ctx.telegramAuth.userId;
    if (!telegramUserId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Telegram authorization required' });
    }

    const details = await getPurchaseDetails(input.bookId, telegramUserId);
    return {
      purchased: Boolean(details),
      details: details ?? null,
    };
  }),
  confirm: authorizedProcedure.input(confirmPurchaseInput).mutation(async ({ input, ctx }) => {
    const telegramUserId = ctx.telegramAuth.userId;
    if (!telegramUserId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Telegram authorization required' });
    }

    const book = await getBook(input.bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    const invoiceStatus = await fetchStarsInvoiceStatus(input.paymentId).catch((error) => {
      markInvoiceAsFailed(input.paymentId);
      throw error;
    });

    if (invoiceStatus.status !== 'paid') {
      markInvoiceAsFailed(input.paymentId);
      throw new Error('Payment is not completed');
    }

    const purchasedAt = new Date().toISOString();

    const purchaseDetails = {
      paymentId: invoiceStatus.paymentId,
      purchasedAt,
      filePath: book.filePath ?? null,
    };

    await setPurchased(book.id, telegramUserId, purchaseDetails);

    return {
      ok: true,
      purchase: {
        bookId: book.id,
        ...purchaseDetails,
      },
    };
  }),
  list: authorizedProcedure.query(async ({ ctx }) => {
    const telegramUserId = ctx.telegramAuth.userId;
    if (!telegramUserId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Telegram authorization required' });
    }

    return { items: await listPurchasedBooks(telegramUserId) };
  }),
});
