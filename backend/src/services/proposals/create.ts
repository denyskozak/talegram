import type { Buffer } from 'node:buffer';
import type { BookProposal } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { prisma } from '../../utils/prisma.js';
import { uploadToWalrusStorage } from '../walrus-storage.js';

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

  const uploadResult = await uploadToWalrusStorage({
    data: params.file.data,
    fileName: params.file.name,
    contentType: params.file.mimeType,
  });

  const coverUploadResult = await uploadToWalrusStorage({
    data: params.cover.data,
    fileName: params.cover.name,
    contentType: params.cover.mimeType,
  });

  const proposal = await prisma.bookProposal.create({
    data: {
      title: params.title,
      author: params.author,
      description: params.description,
      walrusBlobId: uploadResult.blobId,
      walrusBlobUrl: uploadResult.url,
      coverWalrusBlobId: coverUploadResult.blobId,
      coverWalrusBlobUrl: coverUploadResult.url,
      coverMimeType: coverUploadResult.mimeType,
      coverFileName: params.cover.name,
      coverFileSize: coverUploadResult.size,
      fileName: params.file.name,
      fileSize: uploadResult.size,
      mimeType: uploadResult.mimeType,
    },
  });

  return proposal;
}
