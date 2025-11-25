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

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const FALLBACK_INVOICE_BASE_URL = 'https://t.me/stars-payments-demo/app/invoice';

const invoices = new Map<string, StarsInvoiceRecord>();

export async function createStarsInvoice(params: CreateStarsInvoiceParams): Promise<StarsInvoice> {
  const paymentId = randomUUID();

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;
  const providerToken = process.env.PAYMENT_PROVIDER_TOKEN;

  let invoiceLink: string | null = null;

  if (!botToken || !providerToken) {
    invoiceLink = `${FALLBACK_INVOICE_BASE_URL}/${params.bookId}/${paymentId}`;
  } else {
    const priceInStars = Math.max(1, params.amountStars);
    const priceInMinUnits = priceInStars * 100;

    const apiUrl = `${TELEGRAM_API_BASE}${botToken}/createInvoiceLink`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        description: `Purchase access to ${params.title}`,
        payload: JSON.stringify({ paymentId, bookId: params.bookId }),
        provider_token: providerToken,
        currency: 'XTR',
        prices: [{ label: params.title, amount: priceInMinUnits }],
      }),
    });

    const data: unknown = await response.json();
    invoiceLink =
      typeof data === 'object' && data !== null && 'ok' in data && (data as { ok: boolean }).ok &&
      typeof (data as { result?: unknown }).result === 'string'
        ? ((data as { result: string }).result as string)
        : null;
  }

  if (!invoiceLink) {
    throw new Error('Failed to create Telegram invoice link');
  }

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
