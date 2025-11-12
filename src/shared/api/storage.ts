import { trpc } from "./trpc";

export type DecryptedBlob = {
  blobId: string;
  fileName: string | null;
  mimeType: string | null;
  data: string;
};

export async function fetchDecryptedBlob(blobId: string): Promise<DecryptedBlob> {
  const response = await trpc.storage.getDecryptedBlob.query({ blobId });
  return response;
}
