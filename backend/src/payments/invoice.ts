import { createStarsInvoice, type StarsCurrency } from '../services/telegram-payments.js';

export type Invoice = {
  paymentId: string;
  invoiceLink: string;
  amountStars: number;
  currency: StarsCurrency;
};

export const createInvoice = async (params: {
  bookId: string;
  title: string;
  amountStars: number;
}): Promise<Invoice> => {
  const invoice = await createStarsInvoice({
    bookId: params.bookId,
    title: params.title,
    amountStars: params.amountStars,
  });

  return {
    paymentId: invoice.paymentId,
    invoiceLink: invoice.invoiceLink,
    amountStars: invoice.amountStars,
    currency: invoice.currency,
  };
};
