import type { ID } from "@/entities/book/types";

export type Invoice = {
  paymentId: string;
  invoiceLink: string;
  amountStars: number;
  currency: string;
};

export type CreateInvoicePayload = {
  bookId: ID;
};

