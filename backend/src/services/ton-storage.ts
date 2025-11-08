import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type TonStorageUploadParams = {
  data: Buffer;
  fileName: string;
  contentType?: string;
};

export type TonStorageUploadResult = {
  key: string;
  url: string;
  size: number;
  mimeType?: string;
};

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'ton');
const DEFAULT_PUBLIC_BASE_URL = 'https://ton.storage/mock';

const ENCRYPTION_KEY = Buffer.from(
  'e2051a3dc8b842f7c4a7d5f3aa32ce0d9d8be81a3cf41272d9bdf4356e1a9e58',
  'hex',
);
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function resolveStorageDir(): string {
  const customDir = process.env.TON_STORAGE_LOCAL_DIR;
  return customDir ? path.resolve(customDir) : DEFAULT_STORAGE_DIR;
}

function resolvePublicBaseUrl(): string {
  const raw = process.env.TON_STORAGE_PUBLIC_URL;
  if (!raw) {
    return DEFAULT_PUBLIC_BASE_URL;
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export class TonStorageNotFoundError extends Error {}

export async function uploadToTonStorage(
  params: TonStorageUploadParams,
): Promise<TonStorageUploadResult> {
  const storageDir = resolveStorageDir();
  await mkdir(storageDir, { recursive: true });

  const extension = path.extname(params.fileName);
  const key = `${randomUUID()}${extension}`;
  const absolutePath = path.join(storageDir, sanitizeKey(key));

  const encryptedPayload = encryptPayload(params.data);

  await writeFile(absolutePath, encryptedPayload);

  const publicBaseUrl = resolvePublicBaseUrl();
  const url = `${publicBaseUrl}/${key}`;

  return {
    key,
    url,
    size: params.data.byteLength,
    mimeType: params.contentType,
  };
}

export async function downloadFromTonStorage(key: string): Promise<Buffer> {
  const storageDir = resolveStorageDir();
  const absolutePath = path.join(storageDir, sanitizeKey(key));

  try {
    return await readFile(absolutePath);
  } catch (error: unknown) {
    if (!isEnoentError(error)) {
      throw error;
    }
  }

  const publicBaseUrl = resolvePublicBaseUrl();
  try {
    const response = await fetch(`${publicBaseUrl}/${encodeURIComponent(key)}`);
    if (response.status === 404) {
      throw new TonStorageNotFoundError(`File ${key} was not found in TON Storage`);
    }

    if (!response.ok) {
      throw new Error(`Unexpected response ${response.status} from TON Storage`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: unknown) {
    if (error instanceof TonStorageNotFoundError) {
      throw error;
    }

    throw new Error(
      `Failed to download ${key} from TON Storage: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function decryptTonStoragePayload(payload: Buffer): Buffer {
  if (payload.byteLength < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload is too short');
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
}

function encryptPayload(payload: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

function sanitizeKey(key: string): string {
  const normalized = path.basename(key);
  if (normalized !== key) {
    throw new Error('Invalid TON Storage key');
  }
  return normalized;
}

function isEnoentError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
