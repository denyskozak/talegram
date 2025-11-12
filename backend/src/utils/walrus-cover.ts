import { Buffer } from 'node:buffer';
import { suiClient } from '../services/walrus-storage.js';

const walrusCoverCache = new Map<string, string>();

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

  const cached = walrusCoverCache.get(blobId);
  if (cached) {
    return cached;
  }

  try {
    const blob = await suiClient.walrus.getBlob({ blobId });
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
