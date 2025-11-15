import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { suiClient } from '../services/walrus-storage.js';

type WriteWalrusFilesParams = Parameters<typeof suiClient.walrus.writeFiles>[0];
type WriteWalrusFilesResult = Awaited<ReturnType<typeof suiClient.walrus.writeFiles>>;

const MAX_CACHE_SIZE = 100;
const CACHE_DIRECTORY = path.resolve(process.cwd(), '.files');
const CACHE_EXTENSION = '.cache';
const MISS_EXTENSION = '.miss';

const fileCache = new Map<string, string | null>();
let ensureCacheDirectoryPromise: Promise<void> | null = null;

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
