import { Buffer } from 'node:buffer';
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { Purchase } from '../entities/Purchase.js';
import { CommunityMember } from '../entities/CommunityMember.js';
import { createBookFileDecipher, decryptBookFile } from '../services/encryption.js';
import { appDataSource, initializeDataSource } from './data-source.js';
import { buildAudioPreview, buildEpubPreview } from './preview.js';
import { respondWithError } from '../http/responses.js';

export type BookFileKind = 'book' | 'cover' | 'audiobook';

const STORAGE_ROOT = process.env.FILE_STORAGE_ROOT ?? path.resolve(process.cwd(), 'data/storage');

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
};

function resolveFilePath(storageId?: string | null): string | null {
  if (!storageId) {
    return null;
  }

  const normalized = storageId.trim();
  if (!normalized) {
    return null;
  }

  return path.isAbsolute(normalized) ? normalized : path.join(STORAGE_ROOT, normalized);
}

export async function warmFileCache(fileIds: string[]): Promise<void> {
  await Promise.all(
    fileIds
      .map((id) => resolveFilePath(id))
      .filter((filePath): filePath is string => Boolean(filePath))
      .map(async (filePath) => {
        try {
          await fs.stat(filePath);
        } catch {
          // ignore missing files
        }
      }),
  );
}

export async function fetchStoredFilesBase64(ids: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();

  for (const rawId of ids) {
    const trimmed = rawId.trim();
    const filePath = resolveFilePath(trimmed);

    if (!filePath) {
      result.set(trimmed, null);
      continue;
    }

    try {
      const data = await fs.readFile(filePath);
      result.set(trimmed, data.toString('base64'));
    } catch (error) {
      console.warn('Failed to read stored file', { filePath, error });
      result.set(trimmed, null);
    }
  }

  return result;
}

export async function fetchStoredFileBase64(id: string): Promise<string | null> {
  const result = await fetchStoredFilesBase64([id]);
  return result.get(id.trim()) ?? null;
}

function decodeBase64Buffer(value: string | null | undefined): Buffer | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    const decoded = Buffer.from(value, 'base64');
    return decoded.byteLength > 0 ? decoded : null;
  } catch (error) {
    console.warn('Failed to decode base64 buffer', { error });
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

  return candidate.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-');
}

function sanitizeForHeader(fileName: string): string {
  return fileName.replace(/\r|\n|"/g, '').trim();
}

function formatContentDispositionHeader(fileName: string): string {
  return `attachment; filename="${sanitizeForHeader(fileName)}"`;
}

function determineDownloadFileName(
  entity: { title?: string | null; coverFileName?: string | null; audiobookFileName?: string | null; fileName?: string | null },
  fileKind: BookFileKind,
  mimeType: string | null,
): string {
  const explicitName =
    fileKind === 'cover'
      ? entity.coverFileName
      : fileKind === 'audiobook'
      ? entity.audiobookFileName
      : entity.fileName;
  const normalizedName = typeof explicitName === 'string' ? explicitName.trim() : '';

  if (normalizedName.length > 0) {
    return normalizedName;
  }

  const baseName = sanitizeFileNameBase(entity.title ?? '');
  const extension =
    guessExtensionFromMime(mimeType) ?? (fileKind === 'cover' ? 'jpg' : fileKind === 'audiobook' ? 'mp3' : 'bin');

  if (fileKind === 'cover') {
    return `${baseName}-cover.${extension}`;
  }

  if (fileKind === 'audiobook') {
    return `${baseName}-audiobook.${extension}`;
  }

  return `${baseName}.${extension}`;
}

async function streamFile(
  res: http.ServerResponse,
  options: {
    filePath: string;
    fileName: string;
    mimeType: string;
    transform?: NodeJS.ReadWriteStream;
  },
): Promise<void> {
  try {
    const stats = await fs.stat(options.filePath);

    res.statusCode = 200;
    res.setHeader('Content-Type', options.mimeType);
    res.setHeader('Content-Length', stats.size.toString(10));
    res.setHeader('Content-Disposition', formatContentDispositionHeader(options.fileName));

    if (options.transform) {
      await pipeline(createReadStream(options.filePath), options.transform, res);
    } else {
      await pipeline(createReadStream(options.filePath), res);
    }
  } catch (error) {
    console.error('Failed to stream stored file', { filePath: options.filePath, error });
    respondWithError(res, 500, 'Failed to read stored file');
  }
}

function resolveBookFilePath(book: Book, fileKind: BookFileKind): string | null {
  if (fileKind === 'cover') {
    return resolveFilePath(book.coverFilePath);
  }

  if (fileKind === 'audiobook') {
    return resolveFilePath(book.audiobookFilePath);
  }

  return resolveFilePath(book.filePath);
}

function resolveProposalFilePath(proposal: BookProposal, fileKind: BookFileKind): string | null {
  if (fileKind === 'cover') {
    return resolveFilePath(proposal.coverFilePath);
  }

  if (fileKind === 'audiobook') {
    return resolveFilePath(proposal.audiobookFilePath);
  }

  return resolveFilePath(proposal.filePath);
}

export async function handleBookPreviewRequest(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { bookId: string; fileKind: Exclude<BookFileKind, 'cover'> },
): Promise<void> {
  const normalizedBookId = params.bookId.trim();
  if (!normalizedBookId) {
    respondWithError(res, 400, 'Invalid book id');
    return;
  }

  try {
    await initializeDataSource();
  } catch (error) {
    console.error('Failed to initialize data source for preview download', error);
    respondWithError(res, 500, 'Failed to process preview download');
    return;
  }

  const bookRepository = appDataSource.getRepository(Book);

  let book: Book | null = null;

  try {
    book = await bookRepository.findOne({ where: { id: normalizedBookId } });
  } catch (error) {
    console.error('Failed to load book for preview request', { bookId: normalizedBookId, error });
    respondWithError(res, 500, 'Failed to process preview download');
    return;
  }

  if (!book) {
    respondWithError(res, 404, 'Book not found');
    return;
  }

  const filePath = resolveBookFilePath(book, params.fileKind);
  if (!filePath) {
    respondWithError(res, 404, 'Book file not available for preview');
    return;
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    const mimeType = params.fileKind === 'audiobook' ? book.audiobookMimeType ?? null : book.mimeType ?? null;

    let decryptedBuffer = fileBuffer;
    const iv = decodeBase64Buffer(params.fileKind === 'audiobook' ? book.audiobookFileEncryptionIv : book.fileEncryptionIv);
    const authTag = decodeBase64Buffer(
      params.fileKind === 'audiobook' ? book.audiobookFileEncryptionTag : book.fileEncryptionTag,
    );

    if (iv && authTag) {
      try {
        decryptedBuffer = decryptBookFile(fileBuffer, iv, authTag);
      } catch (error) {
        console.warn('Failed to decrypt stored book for preview', { bookId: normalizedBookId, filePath, error });
      }
    }

    const previewBuffer =
      params.fileKind === 'audiobook' ? buildAudioPreview(decryptedBuffer) : await buildEpubPreview(decryptedBuffer);

    const resolvedMimeType = mimeType ?? (params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');
    const fileName = determineDownloadFileName(book, params.fileKind, mimeType);

    res.statusCode = 200;
    res.setHeader('Content-Type', resolvedMimeType);
    res.setHeader('Content-Length', previewBuffer.byteLength.toString(10));
    res.setHeader('Content-Disposition', `inline; filename="${sanitizeForHeader(fileName)}"`);
    res.end(previewBuffer);
  } catch (error) {
    console.error('Failed to prepare preview file', { bookId: normalizedBookId, error });
    respondWithError(res, 500, 'Failed to prepare preview');
  }
}

export async function handleBookFileDownloadRequest(
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
    const price = Number.isFinite(book.price) ? Math.max(0, Number(book.price)) : 0;

    if (price > 0) {
      if (!params.telegramUserId) {
        respondWithError(res, 401, 'Telegram user id is required to download this book');
        return;
      }

      try {
        const purchaseRepository = appDataSource.getRepository(Purchase);
        const purchase = await purchaseRepository.findOne({ where: { bookId: book.id, telegramUserId: params.telegramUserId } });

        if (!purchase) {
          respondWithError(res, 403, 'Purchase required to download this book');
          return;
        }
      } catch (error) {
        console.error('Failed to verify purchase before download', { bookId: normalizedBookId, telegramUserId: params.telegramUserId, error });
        respondWithError(res, 500, 'Failed to process file download');
        return;
      }
    }
  }

  const filePath = resolveBookFilePath(book, params.fileKind);
  if (!filePath) {
    respondWithError(res, 404, 'File not found');
    return;
  }

  const mimeType =
    params.fileKind === 'cover'
      ? book.coverMimeType ?? null
      : params.fileKind === 'audiobook'
      ? book.audiobookMimeType ?? null
      : book.mimeType ?? null;

  const fileName = determineDownloadFileName(book, params.fileKind, mimeType);
  const resolvedMimeType = mimeType ?? (params.fileKind === 'cover' ? 'image/jpeg' : params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');

  if (params.fileKind === 'cover') {
    await streamFile(res, { filePath, fileName, mimeType: resolvedMimeType });
    return;
  }

  const iv = decodeBase64Buffer(params.fileKind === 'audiobook' ? book.audiobookFileEncryptionIv : book.fileEncryptionIv);
  const authTag = decodeBase64Buffer(
    params.fileKind === 'audiobook' ? book.audiobookFileEncryptionTag : book.fileEncryptionTag,
  );

  if (!iv || !authTag) {
    respondWithError(res, 500, 'Missing encryption metadata');
    return;
  }

  const decipher = createBookFileDecipher(iv, authTag);
  await streamFile(res, { filePath, fileName, mimeType: resolvedMimeType, transform: decipher });
}

export async function handleProposalFileDownloadRequest(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { proposalId: string; fileKind: BookFileKind; telegramUserId: string | null },
): Promise<void> {
  const normalizedProposalId = params.proposalId.trim();
  if (!normalizedProposalId) {
    respondWithError(res, 400, 'Invalid proposal id');
    return;
  }

  try {
    await initializeDataSource();
  } catch (error) {
    console.error('Failed to initialize data source for file download', error);
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  const proposalRepository = appDataSource.getRepository(BookProposal);
  const communityMemberRepository = appDataSource.getRepository(CommunityMember);
  let proposal: BookProposal | null = null;

  try {
    proposal = await proposalRepository.findOne({ where: { id: normalizedProposalId } });
  } catch (error) {
    console.error('Failed to load proposal for download request', { proposalId: normalizedProposalId, error });
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  if (!proposal) {
    respondWithError(res, 404, 'Proposal not found');
    return;
  }

  if (params.fileKind !== 'cover') {
    if (!params.telegramUserId) {
      respondWithError(res, 401, 'Telegram user id is required to download this proposal file');
      return;
    }

    try {
      const communityMember = await communityMemberRepository.findOne({ where: { telegramUserId: params.telegramUserId } });
      if (!communityMember) {
        respondWithError(res, 403, 'Community membership required to download this proposal file');
        return;
      }
    } catch (error) {
      console.error('Failed to verify community membership before proposal download', {
        proposalId: normalizedProposalId,
        telegramUserId: params.telegramUserId,
        error,
      });
      respondWithError(res, 500, 'Failed to process file download');
      return;
    }
  }

  const filePath = resolveProposalFilePath(proposal, params.fileKind);
  if (!filePath) {
    respondWithError(res, 404, 'File not found');
    return;
  }

  const mimeType =
    params.fileKind === 'cover'
      ? proposal.coverMimeType ?? null
      : params.fileKind === 'audiobook'
      ? proposal.audiobookMimeType ?? null
      : proposal.mimeType ?? null;
  const fileName = determineDownloadFileName(proposal, params.fileKind, mimeType);
  const resolvedMimeType = mimeType ?? (params.fileKind === 'cover' ? 'image/jpeg' : params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');

  if (params.fileKind === 'cover') {
    await streamFile(res, { filePath, fileName, mimeType: resolvedMimeType });
    return;
  }

  const iv = decodeBase64Buffer(
    params.fileKind === 'audiobook' ? proposal.audiobookFileEncryptionIv : proposal.fileEncryptionIv,
  );
  const authTag = decodeBase64Buffer(
    params.fileKind === 'audiobook' ? proposal.audiobookFileEncryptionTag : proposal.fileEncryptionTag,
  );

  if (!iv || !authTag) {
    respondWithError(res, 500, 'Missing encryption metadata');
    return;
  }

  const decipher = createBookFileDecipher(iv, authTag);
  await streamFile(res, { filePath, fileName, mimeType: resolvedMimeType, transform: decipher });
}

function matchesCoverFile(source: { coverFilePath?: string | null }, id: string): boolean {
  const normalizedId = id.trim();
  return typeof source.coverFilePath === 'string' && source.coverFilePath.trim() === normalizedId;
}

function matchesAudiobookFile(source: { audiobookFilePath?: string | null }, id: string): boolean {
  const normalizedId = id.trim();
  return typeof source.audiobookFilePath === 'string' && source.audiobookFilePath.trim() === normalizedId;
}

function determineSourceFileKind(
  source: {
    coverFilePath?: string | null;
    audiobookFilePath?: string | null;
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

export async function handleStoredFileDownloadRequest(
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
        { filePath: normalizedFileId },
        { audiobookFilePath: normalizedFileId },
        { coverFilePath: normalizedFileId },
      ],
    });
  } catch (error) {
    console.error('Failed to load book for legacy download request', { fileId: normalizedFileId, error });
  }

  if (book) {
    const fileKind = determineSourceFileKind(book, normalizedFileId);
    await handleBookFileDownloadRequest(_req, res, { bookId: book.id, fileKind, telegramUserId: params.telegramUserId });
    return;
  }

  const proposalRepository = appDataSource.getRepository(BookProposal);
  let proposal: BookProposal | null = null;

  try {
    proposal = await proposalRepository.findOne({
      where: [
        { filePath: normalizedFileId },
        { audiobookFilePath: normalizedFileId },
        { coverFilePath: normalizedFileId },
      ],
    });
  } catch (error) {
    console.error('Failed to load proposal for legacy download request', { fileId: normalizedFileId, error });
  }

  if (proposal) {
    const fileKind = determineSourceFileKind(proposal, normalizedFileId);
    await handleProposalFileDownloadRequest(_req, res, {
      proposalId: proposal.id,
      fileKind,
      telegramUserId: params.telegramUserId,
    });
    return;
  }

  respondWithError(res, 404, 'File metadata not found');
}
