import { z } from 'zod';
import { Buffer } from 'node:buffer';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  getPurchaseDetails,
  getPurchased,
  listPurchasedBooks,
  setPurchased,
} from '../stores/purchasesStore.js';
import { getBook } from '../data/catalog.js';
import { fetchStarsInvoiceStatus, markInvoiceAsFailed } from '../services/telegram-payments.js';

const bookIdInput = z.object({
  bookId: z.string().trim().min(1),
});

const confirmPurchaseInput = bookIdInput.extend({
  paymentId: z.string().trim().min(1),
});

export const purchasesRouter = createRouter({
  getStatus: procedure.input(bookIdInput).query(({ input }) => ({
    purchased: getPurchased(input.bookId),
    details: getPurchaseDetails(input.bookId) ?? null,
  })),
  confirm: procedure.input(confirmPurchaseInput).mutation(async ({ input }) => {
    const book = getBook(input.bookId);
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
    };

    setPurchased(book.id, purchaseDetails);

    return {
      ok: true,
      purchase: {
        bookId: book.id,
        ...purchaseDetails,
      },
    };
  }),
  list: procedure.query(() => ({ items: listPurchasedBooks() })),
});
