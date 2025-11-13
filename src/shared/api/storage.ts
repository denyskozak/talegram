import { trpc } from "./trpc";

export type DecryptedFile = {
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  data: string;
};

export async function fetchDecryptedFile(fileId: string): Promise<DecryptedFile> {
  const response = await trpc.storage.getDecryptedFile.query({ fileId });
  return response;
}
