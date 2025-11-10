import type { ID } from "@/entities/book/types";

export type PurchaseDetails = {
  paymentId: string;
  purchasedAt: string;
  tonWalletAddress: string;
  tonTransactionId: string;
  nftAddress: string;
  nftSentAt: string;
};

export type PurchaseStatus = {
  purchased: boolean;
  details: PurchaseDetails | null;
};

export type ConfirmPurchasePayload = {
  bookId: ID;
  paymentId: string;
  tonWalletAddress: string;
};

export type ConfirmPurchaseResponse = {
  ok: boolean;
  purchase: { bookId: ID } & PurchaseDetails;
};

export type PurchasesListResponse = {
  items: Array<{ bookId: ID } & PurchaseDetails>;
};

