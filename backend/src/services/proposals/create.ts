import type { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { WalrusFile } from '@mysten/walrus';
import { BookProposal } from '../../entities/BookProposal.js';
import { appDataSource, initializeDataSource } from '../../utils/data-source.js';
import { keypair, suiClient } from '../walrus-storage.js';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_COVER_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type CreateProposalFileInput = {
  name: string;
  mimeType?: string;
  size?: number;
  data: Buffer;
};

export type CreateBookProposalParams = {
  title: string;
  author: string;
  description: string;
  file: CreateProposalFileInput;
  cover: CreateProposalFileInput;
};

export async function createBookProposal(
  params: CreateBookProposalParams,
): Promise<BookProposal> {
  const fileSize = params.file.size ?? params.file.data.byteLength;
  const coverSize = params.cover.size ?? params.cover.data.byteLength;

  if (!fileSize || params.file.data.byteLength === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded file is empty' });
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size exceeds the allowed limit' });
  }

  if (!coverSize || params.cover.data.byteLength === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Uploaded cover is empty' });
  }

  if (coverSize > MAX_COVER_FILE_SIZE_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cover size exceeds the allowed limit' });
  }

  const bookFile = WalrusFile.from({
    contents: params.file.data,
    identifier: params.file.name,
  });

  const coverFile = WalrusFile.from({
    contents: params.cover.data,
    identifier: params.cover.name,
  });

  const [uploadResult, coverUploadResult] = await suiClient.walrus.writeFiles({
    files: [coverFile, bookFile],
    epochs: 3,
    deletable: true,
    signer: keypair,
  });

  await initializeDataSource();
  const bookProposalRepository = appDataSource.getRepository(BookProposal);
  const proposal = bookProposalRepository.create({
    title: params.title,
    author: params.author,
    description: params.description,
    walrusFileId: uploadResult.id,
    walrusBlobId: uploadResult.blobId,
    walrusBlobUrl: (uploadResult as Record<string, unknown>).blobUrl as string | undefined ?? null,
    coverWalrusFileId: coverUploadResult.id,
    coverWalrusBlobId: coverUploadResult.blobId,
    coverWalrusBlobUrl: (coverUploadResult as Record<string, unknown>).blobUrl as string | undefined ?? null,
    coverMimeType: params.cover.mimeType ?? null,
    coverFileName: params.cover.name,
    coverFileSize: params.cover.size ?? null,
    fileName: params.file.name,
    fileSize: params.file.size ?? null,
    mimeType: params.file.mimeType ?? null,
  });

  return bookProposalRepository.save(proposal);
}
