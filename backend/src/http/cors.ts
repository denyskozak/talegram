import http from 'node:http';

// Разрешённые источники. Добавь сюда свои фронтовые домены при необходимости.
const ALLOWED_ORIGINS = new Set<string>([
    'https://talegramfrontend.gastroand.me',
    'https://talegrafrontendadmin.gastroand.me',
    'https://172.20.10.7:5173',
]);

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
// Базовый список заголовков, если браузер не прислал Access-Control-Request-Headers
const DEFAULT_ALLOWED_HEADERS =
    'content-type,authorization,x-requested-with,x-test-env,trpc-batch-mode,trpc-batch-partial';

export function applyCors(req: http.IncomingMessage, res: http.ServerResponse): void {
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
                : DEFAULT_ALLOWED_HEADERS,
        );

        // Кэшируем preflight, чтобы браузер реже дергал OPTIONS
        res.setHeader('Access-Control-Max-Age', '600');
    }
}
