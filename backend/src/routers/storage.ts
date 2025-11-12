import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { suiClient } from '../services/walrus-storage.js';
import { decryptBookFile } from '../services/encryption.js';

const getDecryptedBlobInput = z.object({
  blobId: z.string().trim().min(1),
});

const getWalrusFilesInput = z.object({
  fileIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(10, 'Too many Walrus files requested at once'),
});

export const storageRouter = createRouter({
  getDecryptedBlob: procedure.input(getDecryptedBlobInput).query(async ({ input }) => {
    await initializeDataSource();

    const bookRepository = appDataSource.getRepository(Book);
    const proposalRepository = appDataSource.getRepository(BookProposal);

    const book = await bookRepository.findOne({ where: { walrusBlobId: input.blobId } });
    const source =
      book ?? (await proposalRepository.findOne({ where: { walrusBlobId: input.blobId } }));

    if (!source) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Blob metadata not found' });
    }

    if (!source.fileEncryptionIv || !source.fileEncryptionTag) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing encryption metadata' });
    }

    let encryptedBytes: Buffer;
    try {
      const blob = await suiClient.walrus.getBlob({ blobId: input.blobId });
      const file = blob.asFile();
      encryptedBytes = Buffer.from(await file.bytes());
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch blob from Walrus' });
    }

    try {
      const decrypted = decryptBookFile(
        encryptedBytes,
        Buffer.from(source.fileEncryptionIv, 'base64'),
        Buffer.from(source.fileEncryptionTag, 'base64'),
      );

      return {
        blobId: input.blobId,
        fileName: source.fileName,
        mimeType: source.mimeType ?? null,
        data: decrypted.toString('base64'),
      };
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to decrypt blob' });
    }
  }),
  getWalrusFiles: procedure.input(getWalrusFilesInput).query(async ({ input }) => {
    try {
      const files = await suiClient.walrus.getFiles({ ids: input.fileIds });

      if (files.length !== input.fileIds.length) {
        throw new Error('Mismatch between requested and received Walrus files');
      }

      const results = await Promise.all(
        files.map(async (file, index) => {
          const bytes = await file.bytes();

          return {
            fileId: input.fileIds[index],
            data: Buffer.from(bytes).toString('base64'),
          };
        }),
      );

      return { files: results };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch files from Walrus',
      });
    }
  }),
});
