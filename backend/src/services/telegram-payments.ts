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

type InvoicePayload = {
    paymentId?: string;
    bookId?: string;
};

type TelegramStarsTransaction = {
    id: string;
    amount?: number;
    total_amount?: number;
    currency: StarsCurrency;
    status: InvoiceStatus | 'pending' | 'active' | 'cancelled';
    invoice_payload?: string;
};

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

const invoices = new Map<string, StarsInvoiceRecord>();
const paymentReceipts = new Map<
    string,
    { userId: number; productId?: string; paymentId?: string; timestamp: number }
>();

const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;

if (!botToken) throw new Error('No bot token provided');

const telegramApiBase = `${TELEGRAM_API_BASE}${botToken}`;

async function fetchTelegramApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${telegramApiBase}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Telegram API call failed: ${method}`);
    }

    const json = await response.json();
    if (json?.ok === false) {
        throw new Error(`Telegram API returned error for ${method}`);
    }

    return (json?.result ?? json) as T;
}

export async function sendTelegramMessage(userId: number, text: string): Promise<void> {
    await fetchTelegramApi('sendMessage', { chat_id: userId, text });
}

export async function configureTelegramWebhook(
    webhookUrl: string,
    allowedUpdates: string[] = ['message', 'pre_checkout_query'],
): Promise<void> {
    await fetchTelegramApi('deleteWebhook', {});
    await fetchTelegramApi('setWebhook', {
        url: webhookUrl,
        allowed_updates: allowedUpdates,
    });
}

export async function approvePreCheckoutQuery(preCheckoutQueryId: string): Promise<void> {
    await fetchTelegramApi('answerPreCheckoutQuery', {
        pre_checkout_query_id: preCheckoutQueryId,
        ok: true,
    });
}

export async function createStarsInvoice(params: CreateStarsInvoiceParams): Promise<StarsInvoice> {
    const paymentId = randomUUID();

    const priceInStars = Math.max(1, params.amountStars);
    const priceInMinUnits = priceInStars * 100;

    const invoiceLink = await fetchTelegramApi<string>('createInvoiceLink', {
        title: params.title,
        description: `Purchase access to ${params.title}`,
        payload: JSON.stringify({ paymentId, bookId: params.bookId }),
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: params.title, amount: priceInMinUnits }],
    });

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

function mapTransactionStatus(status: TelegramStarsTransaction['status']): InvoiceStatus {
    if (status === 'paid') return 'paid';
    if (status === 'failed' || status === 'cancelled') return 'failed';
    return 'pending';
}

async function fetchStarsTransactions(): Promise<TelegramStarsTransaction[]> {
    const result = await fetchTelegramApi<{ transactions?: TelegramStarsTransaction[] } | TelegramStarsTransaction[]>(
        'getStarTransactions',
        { offset: 0, limit: 100 },
    );

    if (Array.isArray(result)) {
        return result;
    }

    return result.transactions ?? [];
}

function parseInvoicePayload(payload: string | undefined): InvoicePayload {
    if (!payload) {
        return {};
    }

    try {
        return JSON.parse(payload);
    } catch (error) {
        console.warn('Failed to parse invoice payload', error);
        return {};
    }
}

function mapStarsAmountToCurrencyUnits(amount: number | undefined): number {
    if (!amount || Number.isNaN(amount)) {
        return 0;
    }

    return Math.max(1, Math.round(amount / 100));
}

export async function fetchStarsInvoiceStatus(paymentId: string): Promise<StarsInvoiceStatus> {
    const invoice = invoices.get(paymentId);
    if (!invoice) {
        throw new Error('Invoice not found');
    }

    const transactions = await fetchStarsTransactions();
    const matchingTransaction = transactions.find((transaction) => {
        const payload = parseInvoicePayload(transaction.invoice_payload);
        return payload.paymentId === paymentId;
    });

    const status = matchingTransaction ? mapTransactionStatus(matchingTransaction.status) : invoice.status;
    const amountStars = matchingTransaction
        ? mapStarsAmountToCurrencyUnits(matchingTransaction.total_amount ?? matchingTransaction.amount)
        : invoice.amountStars;

    const updatedInvoice: StarsInvoiceRecord = {
        ...invoice,
        status,
        amountStars,
    };

    invoices.set(paymentId, updatedInvoice);

    return {
        paymentId: updatedInvoice.paymentId,
        status: updatedInvoice.status,
        amountStars: updatedInvoice.amountStars,
        currency: updatedInvoice.currency,
    };
}

export function markInvoiceAsFailed(paymentId: string): void {
    const invoice = invoices.get(paymentId);
    if (!invoice) {
        return;
    }

    invoices.set(paymentId, { ...invoice, status: 'failed' });
}

export function recordSuccessfulPayment(params: {
    telegramPaymentChargeId: string;
    userId: number;
    invoicePayload?: string;
    totalAmount?: number;
    currency: StarsCurrency;
}): InvoicePayload | null {
    const payload = parseInvoicePayload(params.invoicePayload);
    const amountStars = mapStarsAmountToCurrencyUnits(params.totalAmount);

    paymentReceipts.set(params.telegramPaymentChargeId, {
        userId: params.userId,
        productId: payload.bookId,
        paymentId: payload.paymentId,
        timestamp: Date.now(),
    });

    if (payload.paymentId) {
        const invoice = invoices.get(payload.paymentId);
        if (invoice) {
            invoices.set(payload.paymentId, {
                ...invoice,
                status: 'paid',
                amountStars: amountStars || invoice.amountStars,
                currency: params.currency,
            });
        }
    }

    return payload.paymentId || payload.bookId ? payload : null;
}

export async function refundStarsPayment(
    telegramPaymentChargeId: string,
    userId: number,
): Promise<boolean> {
    const payment = paymentReceipts.get(telegramPaymentChargeId);
    if (!payment || payment.userId !== userId) {
        return false;
    }

    await fetchTelegramApi('refundStarPayment', {
        user_id: userId,
        telegram_payment_charge_id: telegramPaymentChargeId,
    });

    paymentReceipts.delete(telegramPaymentChargeId);
    await sendTelegramMessage(userId, '✅ Stars refunded!');

    return true;
}
