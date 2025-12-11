import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import {
  FileNotFoundError,
  StorageFileFetchError,
  resolveDecryptedFile,
} from '../services/storage/files.js';

const MAX_CACHE_SIZE = 50;

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

      if (error instanceof StorageFileFetchError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to resolve stored file' });
    }
  }),
});
