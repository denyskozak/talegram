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

type CachedDecryptedBlob = {
  blobId: string;
  fileName: string | null;
  mimeType: string | null;
  data: string;
};

const decryptedBlobCache = new Map<string, CachedDecryptedBlob>();

const getCachedDecryptedBlob = (blobId: string): CachedDecryptedBlob | null => {
  const cached = decryptedBlobCache.get(blobId);
  if (!cached) {
    return null;
  }

  // Refresh entry usage for LRU behaviour
  decryptedBlobCache.delete(blobId);
  decryptedBlobCache.set(blobId, cached);

  return cached;
};

const cacheDecryptedBlob = (blobId: string, value: CachedDecryptedBlob) => {
  if (decryptedBlobCache.has(blobId)) {
    decryptedBlobCache.delete(blobId);
  }

  decryptedBlobCache.set(blobId, value);

  if (decryptedBlobCache.size > MAX_CACHE_SIZE) {
    const oldestKey = decryptedBlobCache.keys().next().value;
    if (oldestKey) {
      decryptedBlobCache.delete(oldestKey);
    }
  }
};

const getDecryptedBlobInput = z.object({
  blobId: z.string().trim().min(1),
});

const getWalrusFilesInput = z.object({
  fileIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(10, 'Too many Walrus files requested at once'),
});

export const storageRouter = createRouter({
  getDecryptedBlob: procedure.input(getDecryptedBlobInput).query(async ({ input }) => {
    const cached = getCachedDecryptedBlob(input.blobId);
    if (cached) {
      return cached;
    }

    await initializeDataSource();

    const bookRepository = appDataSource.getRepository(Book);

    const book = await bookRepository.findOne({
      where: [{ walrusBlobId: input.blobId }, { coverWalrusBlobId: input.blobId }],
    });

    const proposal = book
      ? null
      : await appDataSource.getRepository(BookProposal).findOne({
          where: { walrusBlobId: input.blobId },
        });

    const source = book ?? proposal;

    if (!source) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Blob metadata not found' });
    }

    const isCoverBlob = book?.coverWalrusBlobId === input.blobId;

    let blobBytes: Buffer;
    try {
      const blob = await suiClient.walrus.getBlob({ blobId: input.blobId });
      const file = blob.asFile();
      blobBytes = Buffer.from(await file.bytes());
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch blob from Walrus' });
    }

    if (isCoverBlob) {
      const result: CachedDecryptedBlob = {
        blobId: input.blobId,
        fileName: source.coverFileName ?? null,
        mimeType: source.coverMimeType ?? null,
        data: blobBytes.toString('base64'),
      };

      cacheDecryptedBlob(input.blobId, result);

      return result;
    }

    if (!source.fileEncryptionIv || !source.fileEncryptionTag) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing encryption metadata' });
    }

    try {
      const decrypted = decryptBookFile(
        blobBytes,
        Buffer.from(source.fileEncryptionIv, 'base64'),
        Buffer.from(source.fileEncryptionTag, 'base64'),
      );

      const result: CachedDecryptedBlob = {
        blobId: input.blobId,
        fileName: source.fileName ?? null,
        mimeType: source.mimeType ?? null,
        data: decrypted.toString('base64'),
      };

      cacheDecryptedBlob(input.blobId, result);

      return result;
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to decrypt blob' });
    }
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
