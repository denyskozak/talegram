import { trpc } from "./trpc";

export type WalrusFileData = {
  fileId: string;
  data: string;
};

export async function fetchWalrusFiles(fileIds: string[]): Promise<WalrusFileData[]> {
  if (fileIds.length === 0) {
    return [];
  }

  const response = await trpc.storage.getWalrusFiles.query({ fileIds });
  return response.files;
}
