import { Buffer } from 'node:buffer';
import { suiClient } from '../services/walrus-storage.js';
import { decryptBookFile } from '../services/encryption.js';

function resolveMimeType(mimeType: string | null | undefined): string {
  if (typeof mimeType === 'string' && mimeType.trim().length > 0) {
    return mimeType;
  }

  return 'application/octet-stream';
}

function decodeBase64(value: string | null | undefined): Buffer | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64');
  } catch (error) {
    return null;
  }
}

export async function fetchWalrusBookData(
  blobId: string | null | undefined,
  mimeType: string | null | undefined,
  encryptionIv: string | null | undefined,
  encryptionTag: string | null | undefined,
): Promise<string> {
  if (!blobId) {
    return '';
  }

  try {
    const blob = await suiClient.walrus.getBlob({ blobId });
    const file = blob.asFile();
    const encryptedBytes = Buffer.from(await file.bytes());

    let bytes = encryptedBytes;
    const iv = decodeBase64(encryptionIv);
    const tag = decodeBase64(encryptionTag);

    if (iv && tag) {
      try {
        bytes = decryptBookFile(encryptedBytes, iv, tag);
      } catch (error) {
        // Ignore decryption failures and fall back to the encrypted bytes
        bytes = encryptedBytes;
      }
    }

    return `data:${resolveMimeType(mimeType)};base64,${bytes.toString('base64')}`;
  } catch (error) {
    return '';
  }
}
