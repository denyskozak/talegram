import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { suiClient } from '../services/walrus-storage.js';
import { decryptBookFile } from '../services/encryption.js';

const MAX_CACHE_SIZE = 100;

type CachedDecryptedFile = {
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  data: string;
};

const decryptedFileCache = new Map<string, CachedDecryptedFile>();

const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 16;

const decodeBase64Buffer = (value: string | null | undefined): Buffer | null => {
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
};

const getCachedDecryptedFile = (fileId: string): CachedDecryptedFile | null => {
  const cached = decryptedFileCache.get(fileId);
  if (!cached) {
    return null;
  }

  // Refresh entry usage for LRU behaviour
  decryptedFileCache.delete(fileId);
  decryptedFileCache.set(fileId, cached);

  return cached;
};

const cacheDecryptedFile = (fileId: string, value: CachedDecryptedFile) => {
  if (decryptedFileCache.has(fileId)) {
    decryptedFileCache.delete(fileId);
  }

  decryptedFileCache.set(fileId, value);

  if (decryptedFileCache.size > MAX_CACHE_SIZE) {
    const oldestKey = decryptedFileCache.keys().next().value;
    if (oldestKey) {
      decryptedFileCache.delete(oldestKey);
    }
  }
};

const getDecryptedFileInput = z.object({
  fileId: z.string().trim().min(1),
});

const getWalrusFilesInput = z.object({
  fileIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(10, 'Too many Walrus files requested at once'),
});

const matchesCoverFile = (source: { coverWalrusFileId?: string | null; coverWalrusBlobId?: string | null }, id: string) => {
  const normalizedId = id.trim();
  return (
    (typeof source.coverWalrusFileId === 'string' && source.coverWalrusFileId.trim() === normalizedId) ||
    (typeof source.coverWalrusBlobId === 'string' && source.coverWalrusBlobId.trim() === normalizedId)
  );
};

export const storageRouter = createRouter({
  getDecryptedFile: procedure.input(getDecryptedFileInput).query(async ({ input }) => {
    const cached = getCachedDecryptedFile(input.fileId);
    if (cached) {
      return cached;
    }

    await initializeDataSource();

    const bookRepository = appDataSource.getRepository(Book);

    const book = await bookRepository.findOne({
      where: [
        { walrusFileId: input.fileId },
        { coverWalrusFileId: input.fileId },
        { walrusBlobId: input.fileId },
        { coverWalrusBlobId: input.fileId },
      ],
    });

    const proposal = book
      ? null
      : await appDataSource.getRepository(BookProposal).findOne({
          where: [
            { walrusFileId: input.fileId },
            { coverWalrusFileId: input.fileId },
            { walrusBlobId: input.fileId },
            { coverWalrusBlobId: input.fileId },
          ],
        });

    const source = book ?? proposal;

    if (!source) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'File metadata not found' });
    }

    const isCoverFile = matchesCoverFile(source, input.fileId);

    let blobBytes: Buffer;
    try {
      const files = await suiClient.walrus.getFiles({ ids: [input.fileId] });
      const file = files[0];
      if (!file) {
        throw new Error('Walrus file not found');
      }
      blobBytes = Buffer.from(await file.bytes());
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch file from Walrus' });
    }

    if (isCoverFile) {
      const result: CachedDecryptedFile = {
        fileId: input.fileId,
        fileName: source.coverFileName ?? null,
        mimeType: source.coverMimeType ?? null,
        data: blobBytes.toString('base64'),
      };

      cacheDecryptedFile(input.fileId, result);

      return result;
    }

    const iv = decodeBase64Buffer(source.fileEncryptionIv);
    const tag = decodeBase64Buffer(source.fileEncryptionTag);

    let payload = blobBytes;

    if (iv && iv.byteLength === AES_GCM_IV_LENGTH && tag && tag.byteLength === AES_GCM_TAG_LENGTH) {
      try {
        payload = decryptBookFile(blobBytes, iv, tag);
      } catch (error) {
        console.warn('Failed to decrypt Walrus file, falling back to original payload', {
          fileId: input.fileId,
        });
          console.warn("error: ", error);
      }
    } else {
      console.warn('Missing or invalid encryption metadata for Walrus file', { fileId: input.fileId });
    }

    const result: CachedDecryptedFile = {
      fileId: input.fileId,
      fileName: source.fileName ?? null,
      mimeType: source.mimeType ?? null,
      data: payload.toString('base64'),
    };

    cacheDecryptedFile(input.fileId, result);

    return result;
  }),
  getWalrusFiles: procedure.input(getWalrusFilesInput).query(async ({ input }) => {
    try {
      const files = await suiClient.walrus.getFiles({ ids: input.fileIds });

      if (files.length !== input.fileIds.length) {
        throw new Error('Mismatch between requested and received Walrus files');
      }

      const results = await Promise.all(
        files.map(async (file, index) => {
          const bytes = await file.bytes();

          return {
            fileId: input.fileIds[index],
            data: Buffer.from(bytes).toString('base64'),
          };
        }),
      );

      return { files: results };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch files from Walrus',
      });
    }
  }),
});
