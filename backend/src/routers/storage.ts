import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  FileNotFoundError,
  WalrusFileFetchError,
  resolveDecryptedFile,
} from '../services/storage/files.js';
import { suiClient } from '../services/walrus-storage.js';

const MAX_CACHE_SIZE = 100;

type CachedDecryptedFile = {
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  data: string;
};

const decryptedFileCache = new Map<string, CachedDecryptedFile>();

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

export const storageRouter = createRouter({
  getDecryptedFile: procedure.input(getDecryptedFileInput).query(async ({ input }) => {
    const cached = getCachedDecryptedFile(input.fileId);
    if (cached) {
      return cached;
    }

    try {
      const resolved = await resolveDecryptedFile(input.fileId);

      const result: CachedDecryptedFile = {
        fileId: resolved.fileId,
        fileName: resolved.fileName ?? null,
        mimeType: resolved.mimeType ?? null,
        data: resolved.buffer.toString('base64'),
      };

      cacheDecryptedFile(input.fileId, result);

      return result;
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
      }

      if (error instanceof WalrusFileFetchError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to resolve Walrus file' });
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
