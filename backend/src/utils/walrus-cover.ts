import { Buffer } from 'node:buffer';
import { suiClient } from '../services/walrus-storage.js';

class LRUCache<K, V> {
  #map = new Map<K, V>();
  readonly #capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0 || !Number.isFinite(capacity)) {
      throw new Error('LRUCache capacity must be a positive finite number');
    }
    this.#capacity = capacity;
  }

  get(key: K): V | undefined {
    if (!this.#map.has(key)) {
      return undefined;
    }

    const value = this.#map.get(key)!;
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.#map.has(key)) {
      this.#map.delete(key);
    } else if (this.#map.size >= this.#capacity) {
      const oldestKey = this.#map.keys().next().value;
      if (oldestKey !== undefined) {
        this.#map.delete(oldestKey);
      }
    }

    this.#map.set(key, value);
  }

  clear(): void {
    this.#map.clear();
  }
}

const walrusCoverCache = new LRUCache<string, string>(100);

function resolveMimeType(mimeType: string | null | undefined): string {
  if (typeof mimeType === 'string' && mimeType.trim().length > 0) {
    return mimeType;
  }

  return 'application/octet-stream';
}

export async function fetchWalrusCoverData(
  blobId: string | null | undefined,
  mimeType: string | null | undefined,
): Promise<string> {
  if (!blobId) {
    return '';
  }

    console.log("blobId: ", blobId);
  const cached = walrusCoverCache.get(blobId);
    console.log("cached: ", cached);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const blob = await suiClient.walrus.getBlob({ blobId });
      console.log("blob: ", blob);
    const file = blob.asFile();
    const bytes = await file.bytes();
    const dataUrl = `data:${resolveMimeType(mimeType)};base64,${Buffer.from(bytes).toString('base64')}`;
    walrusCoverCache.set(blobId, dataUrl);
    return dataUrl;
  } catch (error) {
    return '';
  }
}

export function clearWalrusCoverCache(): void {
  walrusCoverCache.clear();
}
