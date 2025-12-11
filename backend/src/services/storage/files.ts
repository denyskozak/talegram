import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';

import { Book } from '../../entities/Book.js';
import { BookProposal } from '../../entities/BookProposal.js';
import { initializeDataSource, appDataSource } from '../../utils/data-source.js';

export class FileNotFoundError extends Error {
  constructor(message = 'File metadata not found') {
    super(message);
    this.name = 'FileNotFoundError';
  }
}

export class StorageFileFetchError extends Error {
  constructor(message = 'Failed to fetch file from storage') {
    super(message);
    this.name = 'StorageFileFetchError';
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

const matchesCoverFile = (
  source: { coverFilePath?: string | null },
  id: string,
) => {
  const normalizedId = id.trim();
  return typeof source.coverFilePath === 'string' && source.coverFilePath.trim() === normalizedId;
};

const matchesAudiobookFile = (
  source: { audiobookFilePath?: string | null },
  id: string,
) => {
  const normalizedId = id.trim();
  return typeof source.audiobookFilePath === 'string' && source.audiobookFilePath.trim() === normalizedId;
};

const determineSourceFileKind = (
  source: {
    coverFilePath?: string | null;
    audiobookFilePath?: string | null;
  },
  id: string,
): 'cover' | 'book' | 'audiobook' => {
  if (matchesCoverFile(source, id)) {
    return 'cover';
  }

  if (matchesAudiobookFile(source, id)) {
    return 'audiobook';
  }

  return 'book';
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
      { filePath: normalizedFileId },
      { coverFilePath: normalizedFileId },
    ],
  });

  const proposal = book
    ? null
    : await appDataSource.getRepository(BookProposal).findOne({
        where: [
          { filePath: normalizedFileId },
          { coverFilePath: normalizedFileId },
        ],
      });

  const source = book ?? proposal;

  if (!source) {
    throw new FileNotFoundError();
  }

  const fileKind = determineSourceFileKind(source, normalizedFileId);

  const resolvedPath =
    fileKind === 'cover'
      ? source.coverFilePath
      : fileKind === 'audiobook'
        ? source.audiobookFilePath
        : source.filePath;

  if (!resolvedPath) {
    throw new FileNotFoundError('Stored file path is missing');
  }

  let blobBytes: Buffer;
  try {
    blobBytes = await fs.readFile(resolvedPath);
  } catch (error) {
    throw new StorageFileFetchError();
  }

  if (fileKind === 'cover') {
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

  if (book) {
    const fileName = fileKind === 'audiobook' ? book.audiobookFileName ?? null : book.fileName ?? null;
    const mimeType = fileKind === 'audiobook' ? book.audiobookMimeType ?? null : book.mimeType ?? null;

    return {
      sourceType: 'book',
      book,
      proposal: null,
      fileId: normalizedFileId,
      fileName,
      mimeType,
      buffer: blobBytes,
      isCoverFile: false,
    } satisfies BookResolvedFile;
  }

  const fileName =
    fileKind === 'audiobook' ? proposal!.audiobookFileName ?? null : proposal!.fileName ?? null;
  const mimeType =
    fileKind === 'audiobook' ? proposal!.audiobookMimeType ?? null : proposal!.mimeType ?? null;

  return {
    sourceType: 'proposal',
    book: null,
    proposal: proposal!,
    fileId: normalizedFileId,
    fileName,
    mimeType,
    buffer: blobBytes,
    isCoverFile: false,
  } satisfies ProposalResolvedFile;
}
