import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const KEY_ENV_NAME = 'ECODING_KEY';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const rawKey = process.env[KEY_ENV_NAME];
  if (!rawKey) {
    throw new Error(`Environment variable ${KEY_ENV_NAME} is required for book encryption`);
  }

  const decoded = Buffer.from(rawKey, 'base64');
  if (decoded.byteLength !== KEY_LENGTH) {
    throw new Error(
      `${KEY_ENV_NAME} must be a base64 encoded ${KEY_LENGTH}-byte key (received ${decoded.byteLength} bytes)`,
    );
  }

  cachedKey = decoded;
  return decoded;
}

export type EncryptionResult = {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function encryptBookFile(data: Buffer): EncryptionResult {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encryptedChunks = [cipher.update(data), cipher.final()];
  const encryptedData = Buffer.concat(encryptedChunks);
  const authTag = cipher.getAuthTag();

  return { encryptedData, iv, authTag };
}

export function decryptBookFile(encryptedData: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedChunks = [decipher.update(encryptedData), decipher.final()];
  return Buffer.concat(decryptedChunks);
}
