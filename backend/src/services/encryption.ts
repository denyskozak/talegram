import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {keypair} from "./walrus-storage";

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;


export type EncryptionResult = {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export function encryptBookFile(data: Buffer): EncryptionResult {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keypair.getSecretKey(), iv);

  const encryptedChunks = [cipher.update(data), cipher.final()];
  const encryptedData = Buffer.concat(encryptedChunks);
  const authTag = cipher.getAuthTag();

  return { encryptedData, iv, authTag };
}

export function decryptBookFile(encryptedData: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, keypair.getSecretKey(), iv);
  decipher.setAuthTag(authTag);

  const decryptedChunks = [decipher.update(encryptedData), decipher.final()];
  return Buffer.concat(decryptedChunks);
}
