import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import { createInvoice } from '../payments/invoice.js';
import { getBook } from '../data/catalog.js';

const createInvoiceInput = z.object({
  bookId: z.string().trim().min(1),
});

export const paymentsRouter = createRouter({
  createInvoice: procedure.input(createInvoiceInput).mutation(async ({ input }) => {
    const book = await getBook(input.bookId);
    if (!book) {
      throw new Error('Book not found');
    }

    return createInvoice({
      bookId: book.id,
      title: book.title,
      amountStars: book.priceStars,
    });
  }),
});
