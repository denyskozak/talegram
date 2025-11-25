import type { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { WalrusFile } from '@mysten/walrus';
import { BookProposal } from '../../entities/BookProposal.js';
import { WalrusFileRecord } from '../../entities/WalrusFileRecord.js';
import { appDataSource, initializeDataSource } from '../../utils/data-source.js';
import { getKeypair } from '../keys.js';
import { encryptBookFile } from '../encryption.js';
import { writeWalrusFiles } from '../../utils/walrus-files.js';
import { normalizeTelegramUserId } from '../../utils/telegram.js';
import { Author } from '../../entities/Author.js';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const WALRUS_STORAGE_EPOCHS = 3;
const WALRUS_EPOCH_DURATION_SECONDS = 7 * 24 * 60 * 60;

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
  submittedByTelegramUserId: string;
  language?: string | null;
};

const MAX_HASHTAGS = 8;

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
  const fileSize = params.file.size ?? params.file.data.byteLength;
  const coverSize = params.cover.size ?? params.cover.data.byteLength;
  const audiobookSize = params.audiobook
    ? params.audiobook.size ?? params.audiobook.data.byteLength
    : null;

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

  if (params.audiobook) {
    if (!audiobookSize || params.audiobook.data.byteLength === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded audiobook is empty' });
    }

    if (audiobookSize > MAX_FILE_SIZE_BYTES) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Audiobook size exceeds the allowed limit' });
    }
  }

  const { encryptedData, iv, authTag } = encryptBookFile(params.file.data);
  const audiobookEncryption = params.audiobook
    ? encryptBookFile(params.audiobook.data)
    : null;

  const bookFile = WalrusFile.from({
    contents: encryptedData,
    identifier: `book:${params.file.name}`,
    tags: params.file.mimeType
      ? {
          'content-type': params.file.mimeType,
        }
      : undefined,
  });

  const coverFile = WalrusFile.from({
    contents: params.cover.data,
    identifier: `cover:${params.cover.name}`,
    tags: params.cover.mimeType
      ? {
          'content-type': params.cover.mimeType,
        }
      : undefined,
  });

  const filesToUpload = [bookFile, coverFile];
  if (params.audiobook && audiobookEncryption) {
    const audiobookFile = WalrusFile.from({
      contents: audiobookEncryption.encryptedData,
      identifier: `audiobook:${params.audiobook.name}`,
      tags: params.audiobook.mimeType
        ? {
            'content-type': params.audiobook.mimeType,
          }
        : undefined,
    });
    filesToUpload.push(audiobookFile);
  }

  const uploadResults = await writeWalrusFiles({
    files: filesToUpload,
    epochs: WALRUS_STORAGE_EPOCHS,
    deletable: true,
    signer: getKeypair(),
  });

  const [uploadResult, coverUploadResult, audiobookUploadResult] = uploadResults;


  if (!uploadResult || !coverUploadResult) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to upload proposal files to Walrus storage',
    });
  }

  if (params.audiobook && !audiobookUploadResult) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to upload audiobook file to Walrus storage',
    });
  }

  await initializeDataSource();
  const bookProposalRepository = appDataSource.getRepository(BookProposal);
  const walrusFileRepository = appDataSource.getRepository(WalrusFileRecord);
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
  const walrusExpiresDate =
    getStartOfCurrentDayUnix() + WALRUS_STORAGE_EPOCHS * WALRUS_EPOCH_DURATION_SECONDS;
  const walrusRecords = [uploadResult, coverUploadResult, audiobookUploadResult]
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.id))
    .map((item) =>
      walrusFileRepository.create({
        warlusFileId: item.id,
        expiresDate: walrusExpiresDate,
      }),
    );

  if (walrusRecords.length > 0) {
    await walrusFileRepository.save(walrusRecords);
  }

  const proposal = bookProposalRepository.create({
    title: params.title,
    author: params.author,
    description: params.description,
    globalCategory,
    category,
    price: normalizedPrice,
    currency,
    hashtags: normalizeHashtags(params.hashtags),
    walrusFileId: uploadResult.id,
    walrusBlobId: uploadResult.blobId,
    audiobookWalrusFileId: audiobookUploadResult?.id ?? null,
    audiobookWalrusBlobId: audiobookUploadResult?.blobId ?? null,
    audiobookMimeType: params.audiobook?.mimeType ?? null,
    audiobookFileName: params.audiobook?.name ?? null,
    audiobookFileSize: params.audiobook?.size ?? null,
    coverWalrusFileId: coverUploadResult.id,
    coverWalrusBlobId: coverUploadResult.blobId,
    coverMimeType: params.cover.mimeType ?? null,
    coverFileName: params.cover.name,
    coverFileSize: params.cover.size ?? null,
    fileName: params.file.name,
    fileSize: params.file.size ?? null,
    mimeType: params.file.mimeType ?? null,
    fileEncryptionIv: iv.toString('base64'),
    fileEncryptionTag: authTag.toString('base64'),
    audiobookFileEncryptionIv: audiobookEncryption?.iv.toString('base64') ?? null,
    audiobookFileEncryptionTag: audiobookEncryption?.authTag.toString('base64') ?? null,
    submittedByTelegramUserId: normalizedUploaderUserId,
    language: typeof params.language === 'string' && params.language.trim().length > 0
      ? params.language.trim()
      : null,
  });

  return bookProposalRepository.save(proposal);
}
