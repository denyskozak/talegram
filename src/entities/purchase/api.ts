import { trpc } from "@/shared/api/trpc";

import type {
  ConfirmPurchasePayload,
  ConfirmPurchaseResponse,
  PurchaseStatus,
  PurchasesListResponse,
} from "./types";
import type { ID } from "@/entities/book/types";

export const purchasesApi = {
  getStatus(bookId: ID): Promise<PurchaseStatus> {
    return trpc.purchases.getStatus.query({ bookId });
  },
  confirm(payload: ConfirmPurchasePayload): Promise<ConfirmPurchaseResponse> {
    return trpc.purchases.confirm.mutation(payload);
  },
  list(): Promise<PurchasesListResponse> {
    return trpc.purchases.list.query();
  },
};

