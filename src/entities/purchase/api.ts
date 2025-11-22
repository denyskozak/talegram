import { trpc } from "@/shared/api/trpc";

import type {
  ConfirmPurchasePayload,
  ConfirmPurchaseResponse,
  PurchaseStatus,
  PurchaseStatusPayload,
  PurchasesListResponse,
} from "./types";
export const purchasesApi = {
  getStatus(payload: PurchaseStatusPayload): Promise<PurchaseStatus> {
    return trpc.purchases.getStatus.query(payload);
  },
  confirm(payload: ConfirmPurchasePayload): Promise<ConfirmPurchaseResponse> {
    return trpc.purchases.confirm.mutate(payload);
  },
  list(): Promise<PurchasesListResponse> {
    return trpc.purchases.list.query();
  },
};

