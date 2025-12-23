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
import type { ParsedFormFile } from '../parsers.js';

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
        const audiobooks = normalizeAudiobooks(fields['audiobooks'], files);
        const legacyAudiobook = files['audiobook'];

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
            audiobooks: audiobooks.length > 0
                ? audiobooks.map((item) => ({
                      title: item.title,
                      file: {
                          name: item.file.filename,
                          mimeType: item.file.mimeType,
                          size: item.file.data.byteLength,
                          data: item.file.data,
                      },
                  }))
                : legacyAudiobook
                    ? [{
                          title: fields['audiobookTitle'] ?? legacyAudiobook.filename,
                          file: {
                              name: legacyAudiobook.filename,
                              mimeType: legacyAudiobook.mimeType,
                              size: legacyAudiobook.data.byteLength,
                              data: legacyAudiobook.data,
                          },
                      }]
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

type NormalizedAudiobookMeta = { id: string; title: string | null; file: ParsedFormFile };

function normalizeAudiobooks(rawValue: string | undefined, files: Record<string, ParsedFormFile>): NormalizedAudiobookMeta[] {
    if (typeof rawValue !== 'string') {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            return [];
        }

        const result: NormalizedAudiobookMeta[] = [];

        for (const entry of parsed) {
            if (!entry || typeof entry.id !== 'string') {
                continue;
            }

            const normalizedId = entry.id.trim();
            if (!normalizedId) {
                continue;
            }

            const fileKey = `audiobook_${normalizedId}`;
            const file = files[fileKey];
            if (!file) {
                continue;
            }

            result.push({
                id: normalizedId,
                title: typeof entry.title === 'string' ? entry.title.trim().slice(0, 128) : null,
                file,
            });
        }

        return result;
    } catch (error) {
        console.warn('Failed to parse audiobooks payload', error);
        return [];
    }
}
