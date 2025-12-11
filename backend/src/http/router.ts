import type http from 'node:http';
import { handleCreateProposalRequest } from './handlers/proposals.js';
import { handleTelegramWebhookRequest } from './handlers/telegram-webhook.js';
import { applyCors } from './cors.js';
import { safeParseUrl } from './url.js';
import { parseTelegramAuth, resolveTelegramUserId } from '../utils/auth.js';
import { normalizeTelegramUserId } from '../utils/telegram.js';
import {
    handleBookFileDownloadRequest,
    handleBookPreviewRequest,
    handleProposalFileDownloadRequest,
} from '../utils/storage-files.js';
import { respondWithError } from './responses.js';

type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export function createRequestHandler(trpcHandler: RequestHandler) {
    return async (req: http.IncomingMessage, res: http.ServerResponse) => {
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

        const webhookMatch = req.method === 'POST' && url?.pathname === '/telegram/web-hook';
        if (webhookMatch) {
            await handleTelegramWebhookRequest(req, res);
            return;
        }

        const previewMatch =
            req.method === 'GET'
                ? url?.pathname.match(/^\/preview\/(books|propsals)\/([^/]+)\/(book|audiobook)\/preview\.(?:epub|mp3)$/)
                : null;
        if (previewMatch) {
            const resource = previewMatch[1];
            if (resource !== 'books') {
                respondWithError(res, 404, 'Preview is available for books only');
                return;
            }

            let decodedId: string;
            try {
                decodedId = decodeURIComponent(previewMatch[2]);
            } catch (error) {
                respondWithError(res, 400, 'Invalid book id');
                return;
            }

            const rawFileKind = previewMatch[3];
            const fileKind = rawFileKind === 'audiobook' ? 'audiobook' : 'book';
            await handleBookPreviewRequest(req, res, { bookId: decodedId, fileKind });
            return;
        }

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
    };
}
