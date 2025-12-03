export type Author = {
  id: string;
  name: string;
  telegramUserId: string;
  payoutBalance: number;
};

export type PublishedBookSale = {
  paymentId: string;
  purchasedAt: string;
  telegramUserId: string;
  walrusBlobId: string | null;
  walrusFileId: string | null;
};

export type PublishedBook = {
  id: string;
  title: string;
  price: number;
  currency: string;
  payoutBalance: number;
  publishedAt: string | null;
  language: string | null;
  sales: PublishedBookSale[];
};

export type PublishedBookDetails = PublishedBook & {
  earnings: {
    total: number;
    currency: string;
  };
};
