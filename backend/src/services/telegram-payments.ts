import { randomUUID } from 'node:crypto';

export type StarsCurrency = 'XTR';

type InvoiceStatus = 'pending' | 'paid' | 'failed';

type CreateStarsInvoiceParams = {
  bookId: string;
  title: string;
  amountStars: number;
};

type StarsInvoiceRecord = {
  paymentId: string;
  bookId: string;
  title: string;
  amountStars: number;
  currency: StarsCurrency;
  status: InvoiceStatus;
  invoiceLink: string;
  createdAt: string;
};

type StarsInvoice = Pick<StarsInvoiceRecord, 'paymentId' | 'invoiceLink' | 'amountStars' | 'currency'>;

type StarsInvoiceStatus = Pick<StarsInvoiceRecord, 'paymentId' | 'status' | 'amountStars' | 'currency'>;

const STARS_INVOICE_BASE_URL = 'https://t.me/stars-payments-demo/app/invoice';

const invoices = new Map<string, StarsInvoiceRecord>();

export async function createStarsInvoice(params: CreateStarsInvoiceParams): Promise<StarsInvoice> {
  const paymentId = randomUUID();
  const invoiceLink = `${STARS_INVOICE_BASE_URL}/${params.bookId}/${paymentId}`;

  invoices.set(paymentId, {
    paymentId,
    bookId: params.bookId,
    title: params.title,
    amountStars: params.amountStars,
    currency: 'XTR',
    status: 'pending',
    invoiceLink,
    createdAt: new Date().toISOString(),
  });

  return {
    paymentId,
    invoiceLink,
    amountStars: params.amountStars,
    currency: 'XTR',
  };
}

export async function fetchStarsInvoiceStatus(paymentId: string): Promise<StarsInvoiceStatus> {
  const invoice = invoices.get(paymentId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status === 'pending') {
    invoice.status = 'paid';
    invoices.set(paymentId, invoice);
  }

  return {
    paymentId: invoice.paymentId,
    status: invoice.status,
    amountStars: invoice.amountStars,
    currency: invoice.currency,
  };
}

export function markInvoiceAsFailed(paymentId: string): void {
  const invoice = invoices.get(paymentId);
  if (!invoice) {
    return;
  }

  invoices.set(paymentId, { ...invoice, status: 'failed' });
}
