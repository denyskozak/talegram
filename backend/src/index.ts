import 'reflect-metadata';
import { config } from 'dotenv';
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/context.js';
import { appDataSource, initializeDataSource } from './utils/data-source.js';
import {
    MAX_COVER_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_BYTES,
    createBookProposal,
} from './services/proposals/create.js';
import {
    handleBookFileDownloadRequest,
    handleProposalFileDownloadRequest,
} from './utils/walrus-files.js';
import { parseTelegramAuth, resolveTelegramUserId, resolveTelegramUsername } from './utils/auth.js';

config();

await initializeDataSource();

const port = Number(process.env.PORT) || 3000;

const trpcHandler = createHTTPHandler({
    router: appRouter,
    createContext: createTRPCContext,
});

// Разрешённые источники. Добавь сюда свои фронтовые домены при необходимости.
const ALLOWED_ORIGINS = new Set<string>([
    'https://192.168.1.80:5173',
    'https://192.168.1.80:5174',
    'http://localhost:5174',
    'https://bridgette-nonfertile-nonimmanently.ngrok-free.dev',
    'https://talegramfrontend.gastroand.me',
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

const server = http.createServer(async (req, res) => {
    const telegramAuth = parseTelegramAuth(req);
    applyCors(req, res);


    res.setHeader('ngrok-skip-browser-warning', 'true');

    // Preflight: отвечаем сразу
    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    const url = safeParseUrl(req.url, req.headers.host);
    const bookDownloadMatch =
        req.method === 'GET'
            ? url?.pathname.match(/^\/(books|propsals)\/([^/]+)\/(book|cover|audiobook)\/download\.epub$/)
            : null;
    if (bookDownloadMatch) {
        const resource = bookDownloadMatch[1];
        const rawId = bookDownloadMatch[2];
        let decodedId: string;
        try {
            decodedId = decodeURIComponent(rawId);
        } catch (error) {
            respondWithError(res, 400, 'Invalid book id');
            return;
        }

        const telegramUserId = normalizeTelegramUserId(
            resolveTelegramUserId(telegramAuth, url?.searchParams.get('telegramUserId') ?? null),
        );
        const rawFileKind = bookDownloadMatch[3];
        const fileKind = rawFileKind === 'cover'
            ? 'cover'
            : rawFileKind === 'audiobook'
                ? 'audiobook'
                : 'book';

        if (resource === 'books') {
            await handleBookFileDownloadRequest(req, res, {
                bookId: decodedId,
                fileKind,
                telegramUserId,
            });
        } else {
            await handleProposalFileDownloadRequest(req, res, {
                proposalId: decodedId,
                fileKind,
                telegramUserId,
            });
        }
        return;
    }

    if (req.method === 'POST' && url?.pathname === '/proposals') {
        await handleCreateProposalRequest(req, res, telegramAuth);
        return;
    }

    trpcHandler(req, res);
});

server.listen(port, () => {
    console.log(`tRPC server listening on http://localhost:${port}`);
});

export type AppRouter = typeof appRouter;

type ParsedFormFieldMap = Record<string, string>;

type ParsedFormFile = {
    filename: string;
    mimeType?: string;
    data: Buffer;
};

type ParsedFormFileMap = Record<string, ParsedFormFile>;

async function handleCreateProposalRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    telegramAuth: ReturnType<typeof parseTelegramAuth>,
): Promise<void> {
    try {
        if (!isMultipartForm(req)) {
            res.statusCode = 415;
            res.end('Unsupported Media Type');
            return;
        }

        const { fields, files } = await parseMultipartForm(req);

        const title = fields['title'];
        const author = fields['author'];
        const description = fields['description'];
        const globalCategory = fields['globalCategory'];
        const category = fields['category'];
        const priceRaw = fields['price'];
        const hashtagsRaw = fields['hashtags'];
        const telegramUsername = resolveTelegramUsername(telegramAuth, fields['telegramUsername']);
        const file = files['file'];
        const cover = files['cover'];
        const audiobook = files['audiobook'];

        if (!title || !author || !description || !globalCategory || !category || !telegramUsername) {
            res.statusCode = 400;
            res.end('Missing required fields');
            return;
        }

        if (!file) {
            res.statusCode = 400;
            res.end('Book file is required');
            return;
        }

        if (!cover) {
            res.statusCode = 400;
            res.end('Cover file is required');
            return;
        }

        const priceValue = typeof priceRaw === 'string' ? Number.parseFloat(priceRaw) : Number.NaN;
        if (!Number.isFinite(priceValue) || priceValue < 0) {
            res.statusCode = 400;
            res.end('Price must be a non-negative number');
            return;
        }

        const normalizedPrice = Math.round(priceValue);

        if (file.data.byteLength > MAX_FILE_SIZE_BYTES) {
            res.statusCode = 400;
            res.end('File size exceeds the allowed limit');
            return;
        }

        if (cover.data.byteLength > MAX_COVER_FILE_SIZE_BYTES) {
            res.statusCode = 400;
            res.end('Cover size exceeds the allowed limit');
            return;
        }

        const proposal = await createBookProposal({
            title,
            author,
            description,
            globalCategory,
            category,
            price: normalizedPrice,
            hashtags: parseHashtagsField(hashtagsRaw),
            submittedByTelegramUsername: telegramUsername,
            file: {
                name: file.filename,
                mimeType: file.mimeType,
                size: file.data.byteLength,
                data: file.data,
            },
            cover: {
                name: cover.filename,
                mimeType: cover.mimeType,
                size: cover.data.byteLength,
                data: cover.data,
            },
            audiobook: audiobook
                ? {
                      name: audiobook.filename,
                      mimeType: audiobook.mimeType,
                      size: audiobook.data.byteLength,
                      data: audiobook.data,
                  }
                : null,
        });

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(proposal));
    } catch (error) {
        console.error('Failed to handle proposal upload', error);
        res.statusCode = 500;
        res.end('Failed to process proposal upload');
    }
}

function extractFileIdFromPath(pathname: string): string | null {
    const prefix = '/file/download/';
    if (!pathname.startsWith(prefix)) {
        return null;
    }

    const encodedId = pathname.slice(prefix.length);

    try {
        const decoded = decodeURIComponent(encodedId);
        const trimmed = decoded.trim();
        return trimmed.length > 0 ? trimmed : null;
    } catch (error) {
        console.warn('Failed to decode file id from download path', error);
        return null;
    }
}

function normalizeTelegramUserId(rawValue: string | null): string | null {
    if (typeof rawValue !== 'string') {
        return null;
    }

    const trimmed = rawValue.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function respondWithError(res: http.ServerResponse, statusCode: number, message: string): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
}

function parseHashtagsField(rawValue: string | undefined): string[] {
    if (typeof rawValue !== 'string' || rawValue.length === 0) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) {
            return parsed.filter((item) => typeof item === 'string').map((item) => item.trim());
        }
    } catch (error) {
        // Fallback to comma-separated parsing if JSON decoding fails
        return rawValue
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    return [];
}

function isMultipartForm(req: http.IncomingMessage): boolean {
    const contentType = req.headers['content-type'];
    return typeof contentType === 'string' && contentType.startsWith('multipart/form-data');
}

async function parseMultipartForm(
    req: http.IncomingMessage,
): Promise<{ fields: ParsedFormFieldMap; files: ParsedFormFileMap }> {
    const boundary = extractBoundary(req.headers['content-type']);
    if (!boundary) {
        throw new Error('Multipart boundary not found in content-type header');
    }

    const body = await readRequestBody(req);
    return parseMultipartBody(body, boundary);
}

function extractBoundary(contentTypeHeader: string | undefined): string | null {
    if (!contentTypeHeader) {
        return null;
    }

    const boundaryPrefix = 'boundary=';
    const index = contentTypeHeader.indexOf(boundaryPrefix);
    if (index === -1) {
        return null;
    }

    let boundary = contentTypeHeader.slice(index + boundaryPrefix.length);
    if (boundary.startsWith('"') && boundary.endsWith('"')) {
        boundary = boundary.slice(1, -1);
    }

    // Remove any trailing parameters
    const semicolonIndex = boundary.indexOf(';');
    if (semicolonIndex !== -1) {
        boundary = boundary.slice(0, semicolonIndex);
    }

    return boundary.trim();
}

function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        req.on('data', (chunk) => {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks));
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
}

function parseMultipartBody(
    body: Buffer,
    boundary: string,
): { fields: ParsedFormFieldMap; files: ParsedFormFileMap } {
    const delimiter = Buffer.from(`--${boundary}`);
    const fields: ParsedFormFieldMap = {};
    const files: ParsedFormFileMap = {};
    const headerSeparator = Buffer.from('\r\n\r\n');
    const lineBreak = Buffer.from('\r\n');

    let searchStart = 0;

    while (searchStart < body.length) {
        const boundaryIndex = body.indexOf(delimiter, searchStart);
        if (boundaryIndex === -1) {
            break;
        }

        let partStart = boundaryIndex + delimiter.length;

        // Final boundary is marked with two trailing dashes
        if (partStart + 1 < body.length && body[partStart] === 45 && body[partStart + 1] === 45) {
            break;
        }

        // Skip the required CRLF after the boundary
        if (body[partStart] === 13 && body[partStart + 1] === 10) {
            partStart += 2;
        }

        const headerEndIndex = body.indexOf(headerSeparator, partStart);
        if (headerEndIndex === -1) {
            break;
        }

        const headerBytes = body.slice(partStart, headerEndIndex);
        const headers = parseHeaders(headerBytes.toString('utf-8'));

        const contentStart = headerEndIndex + headerSeparator.length;
        const nextBoundaryIndex = body.indexOf(delimiter, contentStart);
        if (nextBoundaryIndex === -1) {
            break;
        }

        let contentEnd = nextBoundaryIndex;
        if (
            nextBoundaryIndex >= 2 &&
            body[nextBoundaryIndex - 2] === lineBreak[0] &&
            body[nextBoundaryIndex - 1] === lineBreak[1]
        ) {
            contentEnd = nextBoundaryIndex - lineBreak.length;
        }

        const content = body.slice(contentStart, contentEnd);

        const disposition = headers['content-disposition'];
        if (disposition) {
            const { name, filename } = parseContentDisposition(disposition);
            if (name) {
                if (filename) {
                    files[name] = {
                        filename,
                        mimeType: headers['content-type'],
                        data: content,
                    };
                } else {
                    fields[name] = content.toString('utf-8');
                }
            }
        }

        searchStart = nextBoundaryIndex;
    }

    return { fields, files };
}

function parseHeaders(rawHeaders: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = rawHeaders.split('\r\n');

    for (const line of lines) {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        headers[key] = value;
    }

    return headers;
}

function parseContentDisposition(
    disposition: string,
): { name: string | null; filename: string | null } {
    const parts = disposition.split(';').map((part) => part.trim());
    let name: string | null = null;
    let filename: string | null = null;

    for (const part of parts) {
        if (part.toLowerCase() === 'form-data') {
            continue;
        }

        const equalsIndex = part.indexOf('=');
        if (equalsIndex === -1) {
            continue;
        }

        const key = part.slice(0, equalsIndex).trim().toLowerCase();
        let value = part.slice(equalsIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }

        if (key === 'name') {
            name = value;
        } else if (key === 'filename') {
            filename = value;
        }
    }

    return { name, filename };
}

function safeParseUrl(requestUrl: string | undefined, hostHeader: string | undefined): URL | null {
    if (!requestUrl) {
        return null;
    }

    const host = hostHeader ?? 'localhost';

    try {
        return new URL(requestUrl, `http://${host}`);
    } catch (error) {
        console.error('Failed to parse request URL', error);
        return null;
    }
}
