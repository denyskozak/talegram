import http from 'node:http';
import { config } from 'dotenv';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/context.js';
import { initializeDataSource } from './utils/data-source.js';
import { configureTelegramWebhook } from './services/telegram-payments.js';
import { createRequestHandler } from './http/router.js';

config();

const port = Number(process.env.PORT) || 3000;

function resolveWebhookUrl(): string | undefined {
    return process.env.TELEGRAM_WEBHOOK_URL;
}

export async function startServer(): Promise<http.Server> {
    await initializeDataSource();

    const webhookUrl = resolveWebhookUrl();
    if (webhookUrl) {
        configureTelegramWebhook(webhookUrl)
            .then(() => {
                console.log('Telegram webhook configured for', webhookUrl);
            })
            .catch((error) => {
                console.error('Failed to configure Telegram webhook', error);
            });
    }

    const trpcHandler = createHTTPHandler({
        router: appRouter,
        createContext: createTRPCContext,
    });

    const server = http.createServer(createRequestHandler(trpcHandler));

    server.listen(port, () => {
        console.log(`tRPC server listening on http://localhost:${port}`);
    });

    return server;
}

export type AppRouter = typeof appRouter;
