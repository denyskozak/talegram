import http from 'node:http';
import { approvePreCheckoutQuery, recordSuccessfulPayment, type StarsCurrency } from '../../services/telegram-payments.js';
import { parseJsonRequestBody } from '../parsers.js';
import { respondWithError, respondWithOk } from '../responses.js';

type TelegramWebhookUpdate = {
    pre_checkout_query?: { id: string };
    message?: {
        text?: string;
        from?: { id: number };
        successful_payment?: {
            total_amount?: number;
            currency: string;
            invoice_payload?: string;
            telegram_payment_charge_id: string;
        };
    };
};

export async function handleTelegramWebhookRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
): Promise<void> {
    try {
        const update = await parseJsonRequestBody<TelegramWebhookUpdate>(req);

        if (update?.pre_checkout_query?.id) {
            await approvePreCheckoutQuery(update.pre_checkout_query.id);
            respondWithOk(res);
            return;
        }

        const successfulPayment = update?.message?.successful_payment;
        if (successfulPayment && update?.message?.from?.id) {
            const payload = recordSuccessfulPayment({
                telegramPaymentChargeId: successfulPayment.telegram_payment_charge_id,
                userId: update.message.from.id,
                invoicePayload: successfulPayment.invoice_payload,
                totalAmount: successfulPayment.total_amount,
                currency: successfulPayment.currency as StarsCurrency,
            });

            respondWithOk(res, payload?.paymentId);
            return;
        }

        respondWithOk(res);
    } catch (error) {
        console.error('Failed to process Telegram webhook', error);
        respondWithError(res, 500, 'Failed to process Telegram webhook');
    }
}
