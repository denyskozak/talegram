import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  getPurchaseDetails,
  getPurchased,
  listPurchasedBooks,
  setPurchased,
} from '../stores/purchasesStore.js';
import { sendBookNft } from '../services/ton-contract.js';

const bookIdInput = z.object({
  bookId: z.string().trim().min(1),
});

const confirmPurchaseInput = bookIdInput.extend({
  paymentId: z.string().trim().min(1),
  tonWalletAddress: z.string().trim().min(3),
});

export const purchasesRouter = createRouter({
  getStatus: procedure.input(bookIdInput).query(({ input }) => ({
    purchased: getPurchased(input.bookId),
    details: getPurchaseDetails(input.bookId) ?? null,
  })),
  confirm: procedure.input(confirmPurchaseInput).mutation(async ({ input }) => {
    const minted = await sendBookNft({
      bookId: input.bookId,
      paymentId: input.paymentId,
      recipientTonAddress: input.tonWalletAddress,
    });

    const purchasedAt = new Date().toISOString();

    const purchaseDetails = {
      paymentId: input.paymentId,
      purchasedAt,
      tonWalletAddress: minted.recipientTonAddress,
      tonTransactionId: minted.transactionId,
      nftAddress: minted.nftAddress,
      nftSentAt: minted.mintedAt,
    };

    setPurchased(input.bookId, purchaseDetails);

    return {
      ok: true,
      purchase: {
        bookId: input.bookId,
        ...purchaseDetails,
      },
    };
  }),
  list: procedure.query(() => ({ items: listPurchasedBooks() })),
});
