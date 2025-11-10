import type { ID } from "@/entities/book/types";

export type Invoice = {
  paymentId: string;
  invoiceLink: string;
};

export type CreateInvoicePayload = {
  bookId: ID;
};

