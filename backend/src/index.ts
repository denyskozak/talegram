import { config } from 'dotenv';
import http from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/context.js';

config();

const port = Number(process.env.PORT) || 3000;

const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: createTRPCContext,
});

// Разрешённые источники. Добавь сюда свои фронтовые домены при необходимости.
const ALLOWED_ORIGINS = new Set<string>([
    'https://192.168.1.80:5173',
    'https://bridgette-nonfertile-nonimmanently.ngrok-free.dev',
    // если фронт иногда открыт по http в локалке, добавь:
    // 'http://192.168.1.80:5173',
]);

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
// Базовый список заголовков, если браузер не прислал Access-Control-Request-Headers
const DEFAULT_ALLOWED_HEADERS =
    'content-type,authorization,x-requested-with,x-test-env,trpc-batch-mode,trpc-batch-partial';

function applyCors(req: http.IncomingMessage, res: http.ServerResponse) {
    const origin = (req.headers.origin as string) || '';

    // Для корректного кэширования прокси/CDN
    res.setHeader('Vary', 'Origin');

    if (ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        // Нужны ли куки/Authorization — оставляем true
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
        // Разрешаем методы
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);

        // Эхоим запрошенные заголовки, иначе — дефолтный список (включая x-test-env)
        const reqHeaders = req.headers['access-control-request-headers'];
        res.setHeader(
            'Access-Control-Allow-Headers',
            typeof reqHeaders === 'string' && reqHeaders.length
                ? reqHeaders
                : DEFAULT_ALLOWED_HEADERS
        );

        // Кэшируем preflight, чтобы браузер реже дергал OPTIONS
        res.setHeader('Access-Control-Max-Age', '600');
    }
}

const server = http.createServer((req, res) => {
    applyCors(req, res);

    res.setHeader('ngrok-skip-browser-warning', 'true');

    // Preflight: отвечаем сразу
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    trpcHandler(req, res).catch((error) => console.error(error));
});

server.listen(port, () => {
    console.log(`tRPC server listening on http://localhost:${port}`);
});

export type AppRouter = typeof appRouter;
