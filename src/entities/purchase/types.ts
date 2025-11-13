import type { ID } from "@/entities/book/types";

export type PurchaseDetails = {
  paymentId: string;
  purchasedAt: string;
  walrusBlobId: string | null;
  walrusFileId: string | null;
};

export type PurchaseStatus = {
  purchased: boolean;
  details: PurchaseDetails | null;
};

export type ConfirmPurchasePayload = {
  bookId: ID;
  paymentId: string;
  telegramUserId: string;
};

export type PurchaseStatusPayload = {
  bookId: ID;
  telegramUserId: string;
};

export type PurchasesListPayload = {
  telegramUserId: string;
};

export type ConfirmPurchaseResponse = {
  ok: boolean;
  purchase: { bookId: ID } & PurchaseDetails;
};

export type PurchasesListResponse = {
  items: Array<{ bookId: ID } & PurchaseDetails>;
};

