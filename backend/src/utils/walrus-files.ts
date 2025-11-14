import { Buffer } from 'node:buffer';

import { suiClient } from '../services/walrus-storage.js';

type WriteWalrusFilesParams = Parameters<typeof suiClient.walrus.writeFiles>[0];
type WriteWalrusFilesResult = Awaited<ReturnType<typeof suiClient.walrus.writeFiles>>;

const MAX_CACHE_SIZE = 100;
const fileCache = new Map<string, string | null>();

function touchCacheEntry(key: string, value: string | null): void {
    console.log("touchCacheEntgry: ", key, value?.slice(0, 100));
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
}

export async function fetchWalrusFilesBase64(
  ids: string[],
): Promise<Map<string, string | null>> {
    console.log("fileCache: ", fileCache);
  const uniqueIds = Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter((id): id is string => id.length > 0),
    ),
  );

  const result = new Map<string, string | null>();
  const missingIds: string[] = [];

  for (const id of uniqueIds) {
    if (fileCache.has(id)) {
        console.log("id: ", id);
        console.log("fileCache: ", fileCache);
      const cached = fileCache.get(id) ?? null;
        console.log("cached: ", cached);
      touchCacheEntry(id, cached);
      result.set(id, cached);
    } else {
      missingIds.push(id);
    }
  }
    console.log("missingIds: ", missingIds);
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
              console.log("1: ", 1);
            touchCacheEntry(fileId, null);
            result.set(fileId, null);
            return;
          }

          try {
            const bytes = await file.bytes();
            const base64 = Buffer.from(bytes).toString('base64');
              console.log("2: ", 2);
            touchCacheEntry(fileId, base64);
            result.set(fileId, base64);
          } catch (error) {
            touchCacheEntry(fileId, null);
            result.set(fileId, null);
          }
        }),
      );
    } catch (error) {
      for (const fileId of missingIds) {
        touchCacheEntry(fileId, null);
        if (!result.has(fileId)) {
          result.set(fileId, null);
        }
      }
    }
  }

  for (const id of uniqueIds) {
    if (!result.has(id)) {
      const cached = fileCache.get(id) ?? null;
      if (cached !== undefined) {
        result.set(id, cached);
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
        touchCacheEntry(item.id, base64);
      } catch (error) {
        // Ignore caching errors but log them for visibility.
        console.error('Failed to cache Walrus file after upload', error);
      }
    }),
  );

  return result;
}
