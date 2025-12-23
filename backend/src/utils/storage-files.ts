import http from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { Purchase } from '../entities/Purchase.js';
import { CommunityMember } from '../entities/CommunityMember.js';
import { AudioBook } from '../entities/AudioBook.js';
import { ProposalAudioBook } from '../entities/ProposalAudioBook.js';
import { appDataSource, initializeDataSource } from './data-source.js';
import { buildAudioPreview, buildEpubPreview } from './preview.js';
import { respondWithError } from '../http/responses.js';

export type BookFileKind = 'book' | 'cover' | 'audiobook';

const STORAGE_ROOT = process.env.FILE_STORAGE_ROOT ?? path.resolve(process.cwd(), 'data/storage');
const DOWNLOAD_CACHE_CONTROL = 'private, max-age=3600, must-revalidate';

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

export function resolveStoredFilePath(storageId?: string | null): string | null {
  return resolveFilePath(storageId);
}

export function getStorageRoot(): string {
  return STORAGE_ROOT;
}

function isWithinStorageRoot(targetPath: string): boolean {
  const resolvedRoot = path.resolve(STORAGE_ROOT);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function getStorageDirectories(storageIds: Array<string | null | undefined>): Set<string> {
  const directories = new Set<string>();

  for (const storageId of storageIds) {
    const filePath = resolveFilePath(storageId);
    if (!filePath) {
      continue;
    }
    const directory = path.dirname(filePath);
    if (isWithinStorageRoot(directory)) {
      directories.add(directory);
    } else {
      console.warn('Skipping removal for path outside storage root', { directory });
    }
  }

  return directories;
}

export async function deleteStorageDirectories(storageIds: Array<string | null | undefined>): Promise<void> {
  const directories = Array.from(getStorageDirectories(storageIds));

  await Promise.all(
    directories.map(async (directory) => {
      try {
        await fs.rm(directory, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to delete storage directory', { directory, error });
      }
    }),
  );
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

function applyDownloadCacheHeaders(res: http.ServerResponse, lastModified?: Date): void {
  res.setHeader('Cache-Control', DOWNLOAD_CACHE_CONTROL);

  if (lastModified) {
    res.setHeader('Last-Modified', lastModified.toUTCString());
  }
}

function determineDownloadFileName(
  entity: { title?: string | null; coverFileName?: string | null; audiobookFileName?: string | null; fileName?: string | null },
  fileKind: BookFileKind,
  mimeType: string | null,
  overrideFileName?: string | null,
): string {
  const explicitName =
    fileKind === 'cover'
      ? entity.coverFileName
      : fileKind === 'audiobook'
      ? overrideFileName ?? entity.audiobookFileName
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
  req: http.IncomingMessage | null,
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

    const rangeHeader = req?.headers.range ?? null;

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

      if (match) {
        const start = match[1] ? Number.parseInt(match[1], 10) : 0;
        const end = match[2] ? Number.parseInt(match[2], 10) : stats.size - 1;

        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end >= stats.size) {
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${stats.size}`);
          res.end();
          return;
        }

        const chunkSize = end - start + 1;

        res.statusCode = 206;
        res.setHeader('Content-Type', options.mimeType);
        res.setHeader('Content-Length', chunkSize.toString(10));
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stats.size}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', formatContentDispositionHeader(options.fileName));
        applyDownloadCacheHeaders(res, stats.mtime);

        const stream = createReadStream(options.filePath, { start, end });

        if (options.transform) {
          await pipeline(stream, options.transform, res);
        } else {
          await pipeline(stream, res);
        }

        return;
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', options.mimeType);
    res.setHeader('Content-Length', stats.size.toString(10));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', formatContentDispositionHeader(options.fileName));
    applyDownloadCacheHeaders(res, stats.mtime);

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

function resolveBookFilePath(book: Book, fileKind: BookFileKind, audioBook?: AudioBook | null): string | null {
  if (fileKind === 'cover') {
    return resolveFilePath(book.coverFilePath);
  }

  if (fileKind === 'audiobook') {
    return resolveFilePath(audioBook?.filePath ?? book.audiobookFilePath);
  }

  return resolveFilePath(book.filePath);
}

function resolveProposalFilePath(
  proposal: BookProposal,
  fileKind: BookFileKind,
  audioBook?: ProposalAudioBook | null,
): string | null {
  if (fileKind === 'cover') {
    return resolveFilePath(proposal.coverFilePath);
  }

  if (fileKind === 'audiobook') {
    return resolveFilePath(audioBook?.filePath ?? proposal.audiobookFilePath);
  }

  return resolveFilePath(proposal.filePath);
}

export async function handleBookPreviewRequest(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { id: string; fileKind: Exclude<BookFileKind, 'cover'> },
): Promise<void> {
  const normalizedId = params.id.trim();
  if (!normalizedId) {
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
  const audioBookRepository = appDataSource.getRepository(AudioBook);

  let book: Book | null = null;
  let audioBook: AudioBook | null = null;

  try {
    if (params.fileKind === 'audiobook') {
      audioBook = await audioBookRepository.findOne({ where: { id: normalizedId } });
      if (audioBook) {
        book = await bookRepository.findOne({ where: { id: audioBook.bookId } });
      }
      if (!audioBook && !book) {
        book = await bookRepository.findOne({ where: { id: normalizedId } });
      }
    } else {
      book = await bookRepository.findOne({ where: { id: normalizedId } });
    }
  } catch (error) {
    console.error('Failed to load book for preview request', { id: normalizedId, error });
    respondWithError(res, 500, 'Failed to process preview download');
    return;
  }

  if (!book || (params.fileKind === 'audiobook' && !audioBook && !book.audiobookFilePath)) {
    respondWithError(res, 404, 'Book not found');
    return;
  }

  const filePath = resolveBookFilePath(book, params.fileKind, audioBook);
  if (!filePath) {
    respondWithError(res, 404, 'Book file not available for preview');
    return;
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    const mimeType = params.fileKind === 'audiobook'
      ? audioBook?.mimeType ?? book.audiobookMimeType ?? null
      : book.mimeType ?? null;

    const previewBuffer =
      params.fileKind === 'audiobook' ? buildAudioPreview(fileBuffer) : await buildEpubPreview(fileBuffer);

    const resolvedMimeType = mimeType ?? (params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');
    const fileName = determineDownloadFileName(book, params.fileKind, mimeType, audioBook?.fileName ?? null);

    res.statusCode = 200;
    res.setHeader('Content-Type', resolvedMimeType);
    res.setHeader('Content-Length', previewBuffer.byteLength.toString(10));
    res.setHeader('Content-Disposition', `inline; filename="${sanitizeForHeader(fileName)}"`);
    applyDownloadCacheHeaders(res);
    res.end(previewBuffer);
  } catch (error) {
    console.error('Failed to prepare preview file', { id: normalizedId, error });
    respondWithError(res, 500, 'Failed to prepare preview');
  }
}

export async function handleBookFileDownloadRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { id: string; fileKind: BookFileKind; telegramUserId: string | null },
): Promise<void> {
  const normalizedId = params.id.trim();
  if (!normalizedId) {
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
  const audioBookRepository = appDataSource.getRepository(AudioBook);
  let book: Book | null = null;
  let audioBook: AudioBook | null = null;

  try {
    if (params.fileKind === 'audiobook') {
      audioBook = await audioBookRepository.findOne({ where: { id: normalizedId } });
      if (audioBook) {
        book = await bookRepository.findOne({ where: { id: audioBook.bookId } });
      }
      if (!audioBook && !book) {
        book = await bookRepository.findOne({ where: { id: normalizedId } });
      }
    } else {
      book = await bookRepository.findOne({ where: { id: normalizedId } });
    }
  } catch (error) {
    console.error('Failed to load book for download request', { id: normalizedId, error });
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  if (!book || (params.fileKind === 'audiobook' && !audioBook && !book.audiobookFilePath)) {
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
        console.error('Failed to verify purchase before download', { bookId: book.id, telegramUserId: params.telegramUserId, error });
        respondWithError(res, 500, 'Failed to process file download');
        return;
      }
    }
  }

    const filePath = resolveBookFilePath(book, params.fileKind, audioBook);
    if (!filePath) {
      respondWithError(res, 404, 'File not found');
      return;
    }

  const mimeType =
    params.fileKind === 'cover'
      ? book.coverMimeType ?? null
      : params.fileKind === 'audiobook'
      ? audioBook?.mimeType ?? book.audiobookMimeType ?? null
      : book.mimeType ?? null;

  const fileName = determineDownloadFileName(
    book,
    params.fileKind,
    mimeType,
    audioBook?.fileName ?? audioBook?.title ?? null,
  );
  const resolvedMimeType = mimeType ?? (params.fileKind === 'cover' ? 'image/jpeg' : params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');

  if (params.fileKind === 'cover') {
    await streamFile(req, res, { filePath, fileName, mimeType: resolvedMimeType });
    return;
  }

  await streamFile(req, res, { filePath, fileName, mimeType: resolvedMimeType });
}

export async function handleProposalFileDownloadRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: { id: string; fileKind: BookFileKind; telegramUserId: string | null },
): Promise<void> {
  const normalizedId = params.id.trim();
  if (!normalizedId) {
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
  const proposalAudioBookRepository = appDataSource.getRepository(ProposalAudioBook);
  let proposal: BookProposal | null = null;
  let audioBook: ProposalAudioBook | null = null;

  try {
    if (params.fileKind === 'audiobook') {
      audioBook = await proposalAudioBookRepository.findOne({ where: { id: normalizedId } });
      if (audioBook) {
        proposal = await proposalRepository.findOne({ where: { id: audioBook.proposalId } });
      }
    } else {
      proposal = await proposalRepository.findOne({ where: { id: normalizedId } });
    }
  } catch (error) {
    console.error('Failed to load proposal for download request', { proposalId: normalizedId, error });
    respondWithError(res, 500, 'Failed to process file download');
    return;
  }

  if (!proposal || (params.fileKind === 'audiobook' && !audioBook)) {
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
        proposalId: normalizedId,
        telegramUserId: params.telegramUserId,
        error,
      });
      respondWithError(res, 500, 'Failed to process file download');
      return;
    }
  }

  const filePath = resolveProposalFilePath(proposal, params.fileKind, audioBook);
  if (!filePath) {
    respondWithError(res, 404, 'File not found');
    return;
  }

  const mimeType =
    params.fileKind === 'cover'
      ? proposal.coverMimeType ?? null
      : params.fileKind === 'audiobook'
      ? audioBook?.mimeType ?? proposal.audiobookMimeType ?? null
      : proposal.mimeType ?? null;
  const fileName = determineDownloadFileName(
    proposal,
    params.fileKind,
    mimeType,
    audioBook?.fileName ?? audioBook?.title ?? null,
  );
  const resolvedMimeType = mimeType ?? (params.fileKind === 'cover' ? 'image/jpeg' : params.fileKind === 'audiobook' ? 'audio/mpeg' : 'application/octet-stream');

  if (params.fileKind === 'cover') {
    await streamFile(req, res, { filePath, fileName, mimeType: resolvedMimeType });
    return;
  }

  await streamFile(req, res, { filePath, fileName, mimeType: resolvedMimeType });
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
  req: http.IncomingMessage,
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
  const audioBookRepository = appDataSource.getRepository(AudioBook);
  let book: Book | null = null;
  let audioBook: AudioBook | null = null;

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

  try {
    audioBook = await audioBookRepository.findOne({ where: { filePath: normalizedFileId } });
  } catch (error) {
    console.error('Failed to load audiobook for legacy download request', { fileId: normalizedFileId, error });
  }

  if (audioBook) {
    await handleBookFileDownloadRequest(req, res, { id: audioBook.id, fileKind: 'audiobook', telegramUserId: params.telegramUserId });
    return;
  }

  if (book) {
    const fileKind = determineSourceFileKind(book, normalizedFileId);
    await handleBookFileDownloadRequest(req, res, { id: book.id, fileKind, telegramUserId: params.telegramUserId });
    return;
  }

  const proposalRepository = appDataSource.getRepository(BookProposal);
  const proposalAudioBookRepository = appDataSource.getRepository(ProposalAudioBook);
  let proposal: BookProposal | null = null;
  let proposalAudioBook: ProposalAudioBook | null = null;

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

  try {
    proposalAudioBook = await proposalAudioBookRepository.findOne({ where: { filePath: normalizedFileId } });
  } catch (error) {
    console.error('Failed to load proposal audiobook for legacy download request', { fileId: normalizedFileId, error });
  }

  if (proposalAudioBook) {
    await handleProposalFileDownloadRequest(req, res, {
      id: proposalAudioBook.id,
      fileKind: 'audiobook',
      telegramUserId: params.telegramUserId,
    });
    return;
  }

  if (proposal) {
    const fileKind = determineSourceFileKind(proposal, normalizedFileId);
    await handleProposalFileDownloadRequest(req, res, {
      id: proposal.id,
      fileKind,
      telegramUserId: params.telegramUserId,
    });
    return;
  }

  respondWithError(res, 404, 'File metadata not found');
}
