import http from 'node:http';
import {
    MAX_COVER_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_BYTES,
    createBookProposal,
} from '../../services/proposals/create.js';
import { normalizeTelegramUserId } from '../../utils/telegram.js';
import { resolveTelegramUserId } from '../../utils/auth.js';
import {
    isMultipartForm,
    parseHashtagsField,
    parseMultipartForm,
} from '../parsers.js';
import type { TelegramAuthData } from '../../utils/auth.js';

export async function handleCreateProposalRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    telegramAuth: TelegramAuthData,
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
        const telegramUserId = normalizeTelegramUserId(
            resolveTelegramUserId(telegramAuth, fields['telegramUserId'] ?? null),
        );
        const language = normalizeLanguage(fields['language']);
        const file = files['file'];
        const cover = files['cover'];
        const audiobook = files['audiobook'];

        if (!title || !author || !description || !globalCategory || !category || !telegramUserId) {
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
            submittedByTelegramUserId: telegramUserId,
            language,
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

function normalizeLanguage(rawValue: string | undefined): string | null {
    if (typeof rawValue !== 'string') {
        return null;
    }

    const trimmed = rawValue.trim();
    if (trimmed.length === 0) {
        return null;
    }

    return trimmed.slice(0, 16);
}
