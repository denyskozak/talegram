import { Buffer } from 'node:buffer';

import { Book } from '../../entities/Book.js';
import { BookProposal } from '../../entities/BookProposal.js';
import { initializeDataSource, appDataSource } from '../../utils/data-source.js';
import { suiClient } from '../walrus-storage.js';
import { decryptBookFile } from '../encryption.js';

const AES_GCM_IV_LENGTH = 12;
const AES_GCM_TAG_LENGTH = 16;

export class FileNotFoundError extends Error {
  constructor(message = 'File metadata not found') {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export class WalrusFileFetchError extends Error {
  constructor(message = 'Failed to fetch file from Walrus') {
    super(message);
    this.name = 'WalrusFileFetchError';
  }
}

type BaseResolvedFile = {
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  buffer: Buffer;
  isCoverFile: boolean;
};

type BookResolvedFile = BaseResolvedFile & {
  sourceType: 'book';
  book: Book;
  proposal: null;
};

type ProposalResolvedFile = BaseResolvedFile & {
  sourceType: 'proposal';
  book: null;
  proposal: BookProposal;
};

export type ResolvedFile = BookResolvedFile | ProposalResolvedFile;

const decodeBase64Buffer = (value: string | null | undefined): Buffer | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return Buffer.from(trimmed, 'base64');
  } catch (error) {
    return null;
  }
};

const matchesCoverFile = (
  source: { coverWalrusFileId?: string | null; coverWalrusBlobId?: string | null },
  id: string,
) => {
  const normalizedId = id.trim();
  return (
    (typeof source.coverWalrusFileId === 'string' && source.coverWalrusFileId.trim() === normalizedId) ||
    (typeof source.coverWalrusBlobId === 'string' && source.coverWalrusBlobId.trim() === normalizedId)
  );
};

export async function resolveDecryptedFile(fileId: string): Promise<ResolvedFile> {
  const normalizedFileId = fileId.trim();
  if (!normalizedFileId) {
    throw new FileNotFoundError();
  }

  await initializeDataSource();

  const bookRepository = appDataSource.getRepository(Book);

  const book = await bookRepository.findOne({
    where: [
      { walrusFileId: normalizedFileId },
      { coverWalrusFileId: normalizedFileId },
      { walrusBlobId: normalizedFileId },
      { coverWalrusBlobId: normalizedFileId },
    ],
  });

  const proposal = book
    ? null
    : await appDataSource.getRepository(BookProposal).findOne({
        where: [
          { walrusFileId: normalizedFileId },
          { coverWalrusFileId: normalizedFileId },
          { walrusBlobId: normalizedFileId },
          { coverWalrusBlobId: normalizedFileId },
        ],
      });

  const source = book ?? proposal;

  if (!source) {
    throw new FileNotFoundError();
  }

  const isCoverFile = matchesCoverFile(source, normalizedFileId);

  let blobBytes: Buffer;
  try {
    const files = await suiClient.walrus.getFiles({ ids: [normalizedFileId] });
    const file = files[0];
    if (!file) {
      throw new Error('Walrus file not found');
    }
    blobBytes = Buffer.from(await file.bytes());
  } catch (error) {
    throw new WalrusFileFetchError();
  }

  if (isCoverFile) {
    if (book) {
      return {
        sourceType: 'book',
        book,
        proposal: null,
        fileId: normalizedFileId,
        fileName: book.coverFileName ?? null,
        mimeType: book.coverMimeType ?? null,
        buffer: blobBytes,
        isCoverFile: true,
      } satisfies BookResolvedFile;
    }

    return {
      sourceType: 'proposal',
      book: null,
      proposal: proposal!,
      fileId: normalizedFileId,
      fileName: proposal!.coverFileName ?? null,
      mimeType: proposal!.coverMimeType ?? null,
      buffer: blobBytes,
      isCoverFile: true,
    } satisfies ProposalResolvedFile;
  }

  const iv = decodeBase64Buffer(source.fileEncryptionIv);
  const tag = decodeBase64Buffer(source.fileEncryptionTag);

  let payload = blobBytes;

  if (iv && iv.byteLength === AES_GCM_IV_LENGTH && tag && tag.byteLength === AES_GCM_TAG_LENGTH) {
    try {
      payload = decryptBookFile(blobBytes, iv, tag);
    } catch (error) {
      console.warn('Failed to decrypt Walrus file, falling back to original payload', {
        fileId: normalizedFileId,
      });
      console.warn('error: ', error);
    }
  } else {
    console.warn('Missing or invalid encryption metadata for Walrus file', {
      fileId: normalizedFileId,
    });
  }

  if (book) {
    return {
      sourceType: 'book',
      book,
      proposal: null,
      fileId: normalizedFileId,
      fileName: book.fileName ?? null,
      mimeType: book.mimeType ?? null,
      buffer: payload,
      isCoverFile,
    } satisfies BookResolvedFile;
  }

  return {
    sourceType: 'proposal',
    book: null,
    proposal: proposal!,
    fileId: normalizedFileId,
    fileName: proposal!.fileName ?? null,
    mimeType: proposal!.mimeType ?? null,
    buffer: payload,
    isCoverFile,
  } satisfies ProposalResolvedFile;
}
