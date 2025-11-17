import { Buffer } from 'node:buffer';
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { Purchase } from '../entities/Purchase.js';
import { decryptBookFile } from '../services/encryption.js';
import { suiClient } from '../services/walrus-storage.js';
import { appDataSource, initializeDataSource } from './data-source.js';

type WriteWalrusFilesParams = Parameters<typeof suiClient.walrus.writeFiles>[0];
type WriteWalrusFilesResult = Awaited<ReturnType<typeof suiClient.walrus.writeFiles>>;

const MAX_CACHE_SIZE = 100;
const CACHE_DIRECTORY = path.resolve(process.cwd(), '.files');
const CACHE_EXTENSION = '.cache';
const MISS_EXTENSION = '.miss';

const fileCache = new Map<string, string | null>();
let ensureCacheDirectoryPromise: Promise<void> | null = null;

const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 16;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/x-mobipocket-ebook': 'mobi',
  'text/plain': 'txt',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
};

export type BookFileKind = 'book' | 'cover' | 'audiobook';

function ensureCacheDirectory(): Promise<void> {
  if (ensureCacheDirectoryPromise === null) {
    ensureCacheDirectoryPromise = fs
      .mkdir(CACHE_DIRECTORY, { recursive: true })
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to create cache directory', error);
        throw error;
      });
  }

  return ensureCacheDirectoryPromise;
}

function getCacheFileBaseName(id: string): string {
  return Buffer.from(id).toString('base64url');
}

function getCacheFilePath(id: string): string {
  return path.join(CACHE_DIRECTORY, `${getCacheFileBaseName(id)}${CACHE_EXTENSION}`);
}

function getCacheMissPath(id: string): string {
  return path.join(CACHE_DIRECTORY, `${getCacheFileBaseName(id)}${MISS_EXTENSION}`);
}

async function persistCacheEntry(key: string, value: string | null): Promise<void> {
  try {
    await ensureCacheDirectory();
  } catch (error) {
    console.error('Failed to ensure cache directory', error);
    return;
  }

  const cacheFilePath = getCacheFilePath(key);
  const missFilePath = getCacheMissPath(key);

  try {
    if (value === null) {
      await fs.writeFile(missFilePath, '', 'utf8');
      await fs.rm(cacheFilePath, { force: true });
    } else {
      await fs.writeFile(cacheFilePath, value, 'utf8');
      await fs.rm(missFilePath, { force: true });
    }
  } catch (error) {
    console.error('Failed to persist Walrus cache entry', error);
  }
}

async function readCacheEntry(key: string): Promise<string | null | undefined> {
  try {
    await ensureCacheDirectory();
  } catch (error) {
    console.error('Failed to ensure cache directory', error);
    return undefined;
  }

  const cacheFilePath = getCacheFilePath(key);
  const missFilePath = getCacheMissPath(key);

  try {
    const content = await fs.readFile(cacheFilePath, 'utf8');
    return content;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code && nodeError.code !== 'ENOENT') {
      console.error('Failed to read Walrus cache entry', error);
      return undefined;
    }
  }

  try {
    await fs.access(missFilePath);
    return null;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code && nodeError.code !== 'ENOENT') {
      console.error('Failed to read Walrus cache miss entry', error);
    }
  }

  return undefined;
}

function touchCacheEntry(key: string, value: string | null, options: { persist?: boolean } = {}): void {
  if (fileCache.has(key)) {
    fileCache.delete(key);
  }
  fileCache.set(key, value);

  if (fileCache.size > MAX_CACHE_SIZE) {
    const oldestKey = fileCache.keys().next().value as string | undefined;
    if (oldestKey !== undefined) {
      fileCache.delete(oldestKey);
    }
  }

  if (options.persist) {
    void persistCacheEntry(key, value);
  }
}

function decodeBase64Buffer(value: string | null | undefined): Buffer | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return Buffer.from(trimmed, 'base64');
  } catch (error) {
    return null;
  }
}

function resolveWalrusStorageId(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  if (typeof primary === 'string') {
    const normalized = primary.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (typeof fallback === 'string') {
    const normalized = fallback.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

function matchesCoverFile(
  source: { coverWalrusFileId?: string | null; coverWalrusBlobId?: string | null },
  id: string,
): boolean {
  const normalizedId = id.trim();
  return (
    (typeof source.coverWalrusFileId === 'string' && source.coverWalrusFileId.trim() === normalizedId) ||
    (typeof source.coverWalrusBlobId === 'string' && source.coverWalrusBlobId.trim() === normalizedId)
  );
}

function matchesAudiobookFile(
  source: { audiobookWalrusFileId?: string | null; audiobookWalrusBlobId?: string | null },
  id: string,
): boolean {
  const normalizedId = id.trim();
  return (
    (typeof source.audiobookWalrusFileId === 'string' && source.audiobookWalrusFileId.trim() === normalizedId) ||
    (typeof source.audiobookWalrusBlobId === 'string' && source.audiobookWalrusBlobId.trim() === normalizedId)
  );
}

function determineSourceFileKind(
  source: {
    coverWalrusFileId?: string | null;
    coverWalrusBlobId?: string | null;
    audiobookWalrusFileId?: string | null;
    audiobookWalrusBlobId?: string | null;
  },
  id: string,
): BookFileKind {
  if (matchesCoverFile(source, id)) {
    return 'cover';
  }

  if (matchesAudiobookFile(source, id)) {
    return 'audiobook';
  }

  return 'book';
}

async function fetchWalrusFileBuffer(id: string): Promise<Buffer | null> {
  const base64 = await fetchWalrusFileBase64(id);
  if (!base64) {
    return null;
  }

  try {
    return Buffer.from(base64, 'base64');
  } catch (error) {
    console.warn('Failed to decode Walrus file base64 payload', { id, error });
    return null;
  }
}

function guessExtensionFromMime(mimeType: string | null | undefined): string | null {
  if (typeof mimeType !== 'string') {
    return null;
  }

  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return MIME_EXTENSION_MAP[normalized] ?? null;
}

function sanitizeFileNameBase(base: string | null | undefined): string {
  const candidate = typeof base === 'string' ? base.replace(/[\s]+/g, ' ').trim() : '';
  if (!candidate) {
    return 'book-file';
  }

  return candidate.replace(/[\\/:*?"<>|]+/g, '_');
}

function determineDownloadFileName(book: Book, fileKind: BookFileKind): string {
  const explicitName =
    fileKind === 'cover'
      ? book.coverFileName
      : fileKind === 'audiobook'
      ? book.audiobookFileName
      : book.fileName;
  const normalized = typeof explicitName === 'string' ? explicitName.trim() : '';
  if (normalized.length > 0) {
    return normalized;
  }

  const baseName = sanitizeFileNameBase(book.title);
  const mimeType =
    fileKind === 'cover'
      ? book.coverMimeType
      : fileKind === 'audiobook'
      ? book.audiobookMimeType
      : book.mimeType;
  const extension = guessExtensionFromMime(mimeType) ?? (fileKind === 'cover' ? 'jpg' : fileKind === 'audiobook' ? 'mp3' : 'bin');

  if (fileKind === 'cover') {
    return `${baseName}-cover.${extension}`;
  }

  if (fileKind === 'audiobook') {
    return `${baseName}-audiobook.${extension}`;
  }

  return `${baseName}.${extension}`;
}

function sanitizeForHeader(value: string): string {
  const trimmed = value.trim();
  const safe = trimmed.length > 0 ? trimmed : 'book-file';
  return safe.replace(/["\\]+/g, '_');
}

function formatContentDispositionHeader(fileName: string): string {
  const sanitized = sanitizeForHeader(fileName);
  const encoded = encodeURIComponent(sanitized);
  return `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}

function respondWithError(res: http.ServerResponse, statusCode: number, message: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

export async function fetchWalrusFilesBase64(
  ids: string[],
): Promise<Map<string, string | null>> {
  const uniqueIds = Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter((id): id is string => id.length > 0),
    ),
  );

  const result = new Map<string, string | null>();
  const missingIds: string[] = [];

  const diskLookupIds: string[] = [];

  for (const id of uniqueIds) {
    if (fileCache.has(id)) {
      const cached = fileCache.get(id) ?? null;
      touchCacheEntry(id, cached);
      result.set(id, cached);
      continue;
    }

    diskLookupIds.push(id);
  }

  if (diskLookupIds.length > 0) {
    const diskResults = await Promise.all(
      diskLookupIds.map(async (id) => ({ id, value: await readCacheEntry(id) })),
    );

    for (const { id, value } of diskResults) {
      if (value !== undefined) {
        touchCacheEntry(id, value);
        result.set(id, value);
      } else {
        missingIds.push(id);
      }
    }
  }

  if (missingIds.length > 0) {
    try {
      const files = await suiClient.walrus.getFiles({ ids: missingIds });
      await Promise.all(
        files.map(async (file, index) => {
          const fileId = missingIds[index];
          if (!fileId) {
            return;
          }

          if (!file) {
            touchCacheEntry(fileId, null, { persist: true });
            result.set(fileId, null);
            return;
          }

          try {
            const bytes = await file.bytes();
            const base64 = Buffer.from(bytes).toString('base64');

            touchCacheEntry(fileId, base64, { persist: true });
            result.set(fileId, base64);
          } catch (error) {
            touchCacheEntry(fileId, null, { persist: true });
            result.set(fileId, null);
          }
        }),
      );
    } catch (error) {
      for (const fileId of missingIds) {
        touchCacheEntry(fileId, null, { persist: true });
        if (!result.has(fileId)) {
          result.set(fileId, null);
        }
      }
    }
  }

  for (const id of uniqueIds) {
    if (!result.has(id)) {
      const cached = fileCache.get(id);
      if (cached !== undefined) {
        result.set(id, cached ?? null);
        continue;
      }

      const diskValue = await readCacheEntry(id);
      if (diskValue !== undefined) {
        touchCacheEntry(id, diskValue);
        result.set(id, diskValue);
      } else {
        result.set(id, null);
      }
    }
  }

  return result;
}

export async function fetchWalrusFileBase64(id: string): Promise<string | null> {
  const result = await fetchWalrusFilesBase64([id]);
  return result.get(id.trim()) ?? null;
}

export async function handleFileDownloadRequest(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { bookId: string; fileKind: BookFileKind; telegramUserId: string | null },
): Promise<void> {
  const normalizedBookId = params.bookId.trim();
  if (!normalizedBookId) {
    respondWithError(res, 400, 'Invalid book id');
    return;
  }

  try {
    await initializeDataSource();
  } catch (error) {
    console.error('Failed to initialize data source for file download', error);
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  const bookRepository = appDataSource.getRepository(Book);
  let book: Book | null = null;

  try {
    book = await bookRepository.findOne({ where: { id: normalizedBookId } });
  } catch (error) {
    console.error('Failed to load book for download request', { bookId: normalizedBookId, error });
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  if (!book) {
    respondWithError(res, 404, 'Book not found');
    return;
  }

  if (params.fileKind !== 'cover') {
    const price = Number.isFinite(book.priceStars) ? Math.max(0, Number(book.priceStars)) : 0;
    if (price > 0) {
      if (!params.telegramUserId) {
        respondWithError(res, 401, 'Telegram user id is required to download this book');
        return;
      }

      try {
        const purchaseRepository = appDataSource.getRepository(Purchase);
        const purchase = await purchaseRepository.findOne({
          where: { bookId: normalizedBookId, telegramUserId: params.telegramUserId },
        });

        if (!purchase) {
          respondWithError(res, 403, 'Purchase required to download this book');
          return;
        }
      } catch (error) {
        console.error('Failed to verify purchase before download', {
          bookId: normalizedBookId,
          telegramUserId: params.telegramUserId,
          error,
        });
        respondWithError(res, 500, 'Failed to process file download');
        return;
      }
    }
  }

  const storageId =
    params.fileKind === 'cover'
      ? resolveWalrusStorageId(book.coverWalrusFileId, book.coverWalrusBlobId)
      : params.fileKind === 'audiobook'
      ? resolveWalrusStorageId(book.audiobookWalrusFileId, book.audiobookWalrusBlobId)
      : resolveWalrusStorageId(book.walrusFileId, book.walrusBlobId);

  if (!storageId) {
    respondWithError(res, 404, 'File not found');
    return;
  }

  const walrusBuffer = await fetchWalrusFileBuffer(storageId);
  if (!walrusBuffer) {
    respondWithError(res, 404, 'File not found');
    return;
  }

  let responseBuffer = walrusBuffer;
  let mimeType =
    params.fileKind === 'cover'
      ? book.coverMimeType ?? null
      : params.fileKind === 'audiobook'
      ? book.audiobookMimeType ?? null
      : book.mimeType ?? null;

  if (params.fileKind === 'book' || params.fileKind === 'audiobook') {
    const iv = decodeBase64Buffer(
      params.fileKind === 'audiobook' ? book.audiobookFileEncryptionIv : book.fileEncryptionIv,
    );
    const authTag = decodeBase64Buffer(
      params.fileKind === 'audiobook' ? book.audiobookFileEncryptionTag : book.fileEncryptionTag,
    );

    if (iv && iv.byteLength === AES_GCM_IV_LENGTH && authTag && authTag.byteLength === AES_GCM_TAG_LENGTH) {
      try {
        responseBuffer = decryptBookFile(walrusBuffer, iv, authTag);
      } catch (error) {
        console.warn('Failed to decrypt Walrus file, falling back to encrypted payload', {
          bookId: normalizedBookId,
          storageId,
          error,
        });
      }
    } else {
      console.warn('Missing or invalid encryption metadata for Walrus file', {
        bookId: normalizedBookId,
        storageId,
      });
    }
  }

  const fileName = determineDownloadFileName(book, params.fileKind);
  const resolvedMimeType =
    mimeType ?? (params.fileKind === 'cover' ? 'image/jpeg' : params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');

  const cacheTimeMs = 2 * 24 * 3600 * 1000;
  res.statusCode = 200;
  res.setHeader('Content-Type', resolvedMimeType);
  res.setHeader('Content-Length', responseBuffer.byteLength.toString(10));
  res.setHeader('Content-Disposition', formatContentDispositionHeader(fileName));
  res.setHeader('Cache-Control', `public, max-age=${Math.floor(cacheTimeMs / 1000)}`);
  res.setHeader('Expires', new Date(Date.now() + cacheTimeMs).toUTCString());
  res.end(responseBuffer);
}

export async function handleWalrusFileDownloadRequest(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { fileId: string; telegramUserId: string | null },
): Promise<void> {
  const normalizedFileId = params.fileId.trim();
  if (!normalizedFileId) {
    respondWithError(res, 400, 'Invalid file id');
    return;
  }

  try {
    await initializeDataSource();
  } catch (error) {
    console.error('Failed to initialize data source for file download', error);
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  const bookRepository = appDataSource.getRepository(Book);
  let book: Book | null = null;

  try {
    book = await bookRepository.findOne({
      where: [
        { walrusFileId: normalizedFileId },
        { audiobookWalrusFileId: normalizedFileId },
        { coverWalrusFileId: normalizedFileId },
        { walrusBlobId: normalizedFileId },
        { audiobookWalrusBlobId: normalizedFileId },
        { coverWalrusBlobId: normalizedFileId },
      ],
    });
  } catch (error) {
    console.error('Failed to load book for legacy download request', {
      fileId: normalizedFileId,
      error,
    });
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  const proposalRepository = appDataSource.getRepository(BookProposal);
  let proposal: BookProposal | null = null;

  if (!book) {
    try {
      proposal = await proposalRepository.findOne({
        where: [
          { walrusFileId: normalizedFileId },
          { audiobookWalrusFileId: normalizedFileId },
          { coverWalrusFileId: normalizedFileId },
          { walrusBlobId: normalizedFileId },
          { audiobookWalrusBlobId: normalizedFileId },
          { coverWalrusBlobId: normalizedFileId },
        ],
      });
    } catch (error) {
      console.error('Failed to load proposal for legacy download request', {
        fileId: normalizedFileId,
        error,
      });
      respondWithError(res, 500, 'Failed to process file download');
      return;
    }
  }

  if (!book && !proposal) {
    respondWithError(res, 404, 'File metadata not found');
    return;
  }

  const fileKind = determineSourceFileKind(book ?? proposal!, normalizedFileId);

  if (book && fileKind !== 'cover') {
    const price = Number.isFinite(book.priceStars) ? Math.max(0, Number(book.priceStars)) : 0;
    if (price > 0) {
      if (!params.telegramUserId) {
        respondWithError(res, 401, 'Telegram user id is required to download this book');
        return;
      }

      try {
        const purchaseRepository = appDataSource.getRepository(Purchase);
        const purchase = await purchaseRepository.findOne({
          where: { bookId: book.id, telegramUserId: params.telegramUserId },
        });

        if (!purchase) {
          respondWithError(res, 403, 'Purchase required to download this book');
          return;
        }
      } catch (error) {
        console.error('Failed to verify purchase before legacy download', {
          fileId: normalizedFileId,
          telegramUserId: params.telegramUserId,
          error,
        });
        respondWithError(res, 500, 'Failed to process file download');
        return;
      }
    }
  }

  const walrusBuffer = await fetchWalrusFileBuffer(normalizedFileId);
  if (!walrusBuffer) {
    respondWithError(res, 404, 'File not found');
    return;
  }

  let responseBuffer = walrusBuffer;
  let mimeType: string | null;
  let fileName: string;

  if (book) {
    mimeType =
      fileKind === 'cover'
        ? book.coverMimeType ?? null
        : fileKind === 'audiobook'
        ? book.audiobookMimeType ?? null
        : book.mimeType ?? null;

    if (fileKind !== 'cover') {
      const iv = decodeBase64Buffer(
        fileKind === 'audiobook' ? book.audiobookFileEncryptionIv : book.fileEncryptionIv,
      );
      const authTag = decodeBase64Buffer(
        fileKind === 'audiobook' ? book.audiobookFileEncryptionTag : book.fileEncryptionTag,
      );

      if (iv && iv.byteLength === AES_GCM_IV_LENGTH && authTag && authTag.byteLength === AES_GCM_TAG_LENGTH) {
        try {
          responseBuffer = decryptBookFile(walrusBuffer, iv, authTag);
        } catch (error) {
          console.warn('Failed to decrypt Walrus file, falling back to encrypted payload', {
            fileId: normalizedFileId,
            error,
          });
        }
      } else {
        console.warn('Missing or invalid encryption metadata for Walrus file', {
          fileId: normalizedFileId,
        });
      }
    }

    fileName = determineDownloadFileName(book, fileKind);
  } else {
    const proposalEntity = proposal!;
    mimeType =
      fileKind === 'cover'
        ? proposalEntity.coverMimeType ?? null
        : fileKind === 'audiobook'
        ? proposalEntity.audiobookMimeType ?? null
        : proposalEntity.mimeType ?? null;

    if (fileKind !== 'cover') {
      const iv = decodeBase64Buffer(
        fileKind === 'audiobook'
          ? proposalEntity.audiobookFileEncryptionIv
          : proposalEntity.fileEncryptionIv,
      );
      const authTag = decodeBase64Buffer(
        fileKind === 'audiobook'
          ? proposalEntity.audiobookFileEncryptionTag
          : proposalEntity.fileEncryptionTag,
      );

      if (iv && iv.byteLength === AES_GCM_IV_LENGTH && authTag && authTag.byteLength === AES_GCM_TAG_LENGTH) {
        try {
          responseBuffer = decryptBookFile(walrusBuffer, iv, authTag);
        } catch (error) {
          console.warn('Failed to decrypt Walrus proposal file, falling back to encrypted payload', {
            fileId: normalizedFileId,
            error,
          });
        }
      }
    }

    const explicitName =
      fileKind === 'cover'
        ? proposalEntity.coverFileName
        : fileKind === 'audiobook'
        ? proposalEntity.audiobookFileName
        : proposalEntity.fileName;
    const normalizedName = typeof explicitName === 'string' ? explicitName.trim() : '';
    if (normalizedName.length > 0) {
      fileName = normalizedName;
    } else {
      const baseName = sanitizeFileNameBase(proposalEntity.title);
      const extension =
        guessExtensionFromMime(mimeType) ?? (fileKind === 'cover' ? 'jpg' : fileKind === 'audiobook' ? 'mp3' : 'bin');
      if (fileKind === 'cover') {
        fileName = `${baseName}-cover.${extension}`;
      } else if (fileKind === 'audiobook') {
        fileName = `${baseName}-audiobook.${extension}`;
      } else {
        fileName = `${baseName}.${extension}`;
      }
    }
  }

  const resolvedMimeType =
    mimeType ?? (fileKind === 'cover' ? 'image/jpeg' : fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');
  const cacheTimeMs = 2 * 24 * 3600 * 1000;

  res.statusCode = 200;
  res.setHeader('Content-Type', resolvedMimeType);
  res.setHeader('Content-Length', responseBuffer.byteLength.toString(10));
  res.setHeader('Content-Disposition', formatContentDispositionHeader(fileName));
  res.setHeader('Cache-Control', `public, max-age=${Math.floor(cacheTimeMs / 1000)}`);
  res.setHeader('Expires', new Date(Date.now() + cacheTimeMs).toUTCString());
  res.end(responseBuffer);
}

export async function warmWalrusFileCache(id: string | null | undefined): Promise<void> {
  if (typeof id !== 'string') {
    return;
  }

  const normalized = id.trim();
  if (!normalized) {
    return;
  }

  try {
    await fetchWalrusFileBase64(normalized);
  } catch (error) {
    console.warn('Failed to warm Walrus cache', { id: normalized, error });
  }
}

export async function writeWalrusFiles(
  params: WriteWalrusFilesParams,
): Promise<WriteWalrusFilesResult> {
  const result = await suiClient.walrus.writeFiles(params);

  await Promise.all(
    result.map(async (item, index) => {
      if (!item) {
        return;
      }

      try {
        const file = params.files[index];
        if (!file) {
          return;
        }

        const bytes = await file.bytes();
        const base64 = Buffer.from(bytes).toString('base64');
        touchCacheEntry(item.id, base64, { persist: true });
      } catch (error) {
        // Ignore caching errors but log them for visibility.
        console.error('Failed to cache Walrus file after upload', error);
      }
    }),
  );

  return result;
}
