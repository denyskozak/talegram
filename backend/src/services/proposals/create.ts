import type { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { BookProposal } from '../../entities/BookProposal.js';
import { appDataSource, initializeDataSource } from '../../utils/data-source.js';
import { normalizeTelegramUserId } from '../../utils/telegram.js';
import { Author } from '../../entities/Author.js';
import { ProposalAudioBook } from '../../entities/ProposalAudioBook.js';

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100m
export const MAX_AUDI_BOOK_SIZE_BYTES = 3 * 1024 * 1024 * 1024; // 3gb
export const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const STORAGE_ROOT = process.env.FILE_STORAGE_ROOT ?? path.resolve(process.cwd(), 'data/storage');

function getStartOfCurrentDayUnix(): number {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

export type CreateProposalFileInput = {
  name: string;
  mimeType?: string;
  size?: number;
  data: Buffer;
};

export type CreateBookProposalParams = {
  title: string;
  author: string;
  description: string;
  globalCategory: string;
  category: string;
  price: number;
  hashtags: string[];
  file: CreateProposalFileInput;
  cover: CreateProposalFileInput;
  audiobook?: CreateProposalFileInput | null;
  audiobooks?: { title?: string | null; file: CreateProposalFileInput | null }[] | null;
  submittedByTelegramUserId: string;
  language?: string | null;
};

const MAX_HASHTAGS = 8;

async function writeBufferToFile(filePath: string, data: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await pipeline(Readable.from(data), createWriteStream(filePath));
}

function sanitizeFileName(rawName: string): string {
  const normalized = rawName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.length > 0 ? normalized : 'file';
}

function normalizeHashtags(rawHashtags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawHashtag of rawHashtags) {
    if (typeof rawHashtag !== 'string') {
      continue;
    }

    const cleaned = rawHashtag.replace(/^#+/, '').trim();
    if (cleaned.length === 0) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(cleaned);

    if (normalized.length >= MAX_HASHTAGS) {
      break;
    }
  }

  return normalized;
}

export async function createBookProposal(
  params: CreateBookProposalParams,
): Promise<BookProposal> {
  const normalizedAudiobooks = Array.isArray(params.audiobooks)
    ? params.audiobooks
        .map((entry) => ({
          title: typeof entry?.title === 'string' ? entry.title.trim().slice(0, 128) : null,
          file: entry?.file ?? null,
        }))
        .filter((entry) => entry.file !== null)
    : [];

  if (normalizedAudiobooks.length === 0 && params.audiobook) {
    normalizedAudiobooks.push({ title: params.audiobook.name ?? null, file: params.audiobook });
  }

  const fileSize = params.file.size ?? params.file.data.byteLength;
  const coverSize = params.cover.size ?? params.cover.data.byteLength;
  if (!fileSize || params.file.data.byteLength === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded file is empty' });
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size exceeds the allowed limit' });
  }

  if (!coverSize || params.cover.data.byteLength === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded cover is empty' });
  }

  if (coverSize > MAX_COVER_FILE_SIZE_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cover size exceeds the allowed limit' });
  }

  normalizedAudiobooks.forEach((entry) => {
    const size = entry.file?.size ?? entry.file?.data.byteLength ?? null;
    if (!size || entry.file?.data.byteLength === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded audiobook is empty' });
    }

    if (size > MAX_AUDI_BOOK_SIZE_BYTES) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Audiobook size exceeds the allowed limit' });
    }
  });

  const proposalId = randomUUID();
  const proposalDir = path.join(STORAGE_ROOT, 'proposals', proposalId);

  const bookFilePath = path.join(proposalDir, `book-${sanitizeFileName(params.file.name)}`);
  const coverFilePath = path.join(proposalDir, `cover-${sanitizeFileName(params.cover.name)}`);
  const proposalAudioBooks = normalizedAudiobooks.map((entry, index) => {
    const sanitizedName = sanitizeFileName(entry.file?.name ?? `audiobook-${index + 1}`);
    const filePath = path.join(proposalDir, 'audiobooks', `${index + 1}-${sanitizedName}`);
    return {
      title: entry.title ?? null,
      filePath,
      mimeType: entry.file?.mimeType ?? null,
      fileName: entry.file?.name ?? null,
      fileSize: entry.file?.size ?? null,
      data: entry.file?.data ?? null,
    };
  });

  const primaryAudio = proposalAudioBooks[0] ?? null;
  const audiobookFilePath = primaryAudio?.filePath ?? null;

  try {
    await Promise.all([
      writeBufferToFile(bookFilePath, params.file.data),
      writeBufferToFile(coverFilePath, params.cover.data),
      ...proposalAudioBooks.map((audioBook) =>
        audioBook.data && audioBook.filePath ? writeBufferToFile(audioBook.filePath, audioBook.data) : Promise.resolve(),
      ),
    ]);
  } catch (error) {
    console.error('Failed to persist proposal files to storage', error);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save proposal files' });
  }

  await initializeDataSource();
  const bookProposalRepository = appDataSource.getRepository(BookProposal);
  const normalizedUploaderUserId = normalizeTelegramUserId(params.submittedByTelegramUserId);
  if (!normalizedUploaderUserId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Telegram user id is required' });
  }
  const authorRepository = appDataSource.getRepository(Author);
  const authorExists = await authorRepository.exist({ where: { telegramUserId: normalizedUploaderUserId } });
  if (!authorExists) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Only approved authors can submit book proposals' });
  }
  const globalCategory = params.globalCategory.trim();
  if (globalCategory.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Global category is required' });
  }

  const category = params.category.trim();
  if (category.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Category is required' });
  }

  const normalizedPrice = Number.isFinite(params.price)
    ? Math.max(0, Math.round(params.price))
    : 0;

  const currency = 'stars';
  const proposal = bookProposalRepository.create({
    id: proposalId,
    title: params.title,
    author: params.author,
    description: params.description,
    globalCategory,
    category,
    price: normalizedPrice,
    currency,
    hashtags: normalizeHashtags(params.hashtags),
    filePath: bookFilePath,
    audiobookFilePath,
    audiobookMimeType: primaryAudio?.mimeType ?? params.audiobook?.mimeType ?? null,
    audiobookFileName: primaryAudio?.fileName ?? params.audiobook?.name ?? null,
    audiobookFileSize: primaryAudio?.fileSize ?? params.audiobook?.size ?? null,
    coverFilePath,
    coverMimeType: params.cover.mimeType ?? null,
    coverFileName: params.cover.name,
    coverFileSize: params.cover.size ?? null,
    fileName: params.file.name,
    fileSize: params.file.size ?? null,
    mimeType: params.file.mimeType ?? null,
    submittedByTelegramUserId: normalizedUploaderUserId,
    language: typeof params.language === 'string' && params.language.trim().length > 0
      ? params.language.trim()
      : null,
  });

  const savedProposal = await bookProposalRepository.save(proposal);

  if (proposalAudioBooks.length > 0) {
    const proposalAudioBookRepository = appDataSource.getRepository(ProposalAudioBook);
    const toPersist = proposalAudioBooks.map((audioBook) =>
      proposalAudioBookRepository.create({
        proposalId: proposalId,
        title: audioBook.title,
        filePath: audioBook.filePath,
        mimeType: audioBook.mimeType,
        fileName: audioBook.fileName,
        fileSize: audioBook.fileSize,
      }),
    );

    await proposalAudioBookRepository.save(toPersist);
  }

  const savedWithAudio = await bookProposalRepository.findOne({
    where: { id: proposalId },
    relations: { audioBooks: true },
  });

  return savedWithAudio ?? savedProposal;
}
