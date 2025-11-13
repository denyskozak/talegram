import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  getPurchaseDetails,
  listPurchasedBooks,
  setPurchased,
} from '../stores/purchasesStore.js';
import { getBook } from '../data/catalog.js';
import { fetchStarsInvoiceStatus, markInvoiceAsFailed } from '../services/telegram-payments.js';

const telegramUserIdInput = z.object({
  telegramUserId: z.string().trim().min(1),
});

const bookIdInput = z.object({
  bookId: z.string().trim().min(1),
});

const purchaseStatusInput = bookIdInput.merge(telegramUserIdInput);

const confirmPurchaseInput = purchaseStatusInput.extend({
  paymentId: z.string().trim().min(1),
});

export const purchasesRouter = createRouter({
  getStatus: procedure.input(purchaseStatusInput).query(async ({ input }) => {
    const details = await getPurchaseDetails(input.bookId, input.telegramUserId);
    return {
      purchased: Boolean(details),
      details: details ?? null,
    };
  }),
  confirm: procedure.input(confirmPurchaseInput).mutation(async ({ input }) => {
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
      walrusBlobId: book.walrusBlobId ?? null,
      walrusFileId: book.walrusFileId ?? null,
    };

    await setPurchased(book.id, input.telegramUserId, purchaseDetails);

    return {
      ok: true,
      purchase: {
        bookId: book.id,
        ...purchaseDetails,
      },
    };
  }),
  list: procedure.input(telegramUserIdInput).query(async ({ input }) => ({
    items: await listPurchasedBooks(input.telegramUserId),
  })),
});
