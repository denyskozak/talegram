import { trpc } from "@/shared/api/trpc";

import type { CreateInvoicePayload, Invoice } from "./types";

export const paymentsApi = {
  createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
    return trpc.payments.createInvoice.mutation(payload);
  },
};

