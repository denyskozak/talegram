export type PurchaseDetails = {
  paymentId: string;
  purchasedAt: string;
};

type PurchaseRecord = PurchaseDetails & { purchased: true };

const purchases = new Map<string, PurchaseRecord>();

export const getPurchased = (bookId: string): boolean => {
  return purchases.get(bookId)?.purchased ?? false;
};

export const setPurchased = (bookId: string, details: PurchaseDetails): void => {
  purchases.set(bookId, { purchased: true, ...details });
};

export const getPurchaseDetails = (bookId: string): PurchaseDetails | undefined => {
  const record = purchases.get(bookId);
  if (!record?.purchased) {
    return undefined;
  }

  const { paymentId, purchasedAt } = record;

  return { paymentId, purchasedAt };
};

export const listPurchasedBooks = (): Array<{ bookId: string } & PurchaseDetails> => {
  return Array.from(purchases.entries())
    .filter(([, value]) => value.purchased)
    .map(([bookId, value]) => ({
      bookId,
      paymentId: value.paymentId,
      purchasedAt: value.purchasedAt
    }));
};
