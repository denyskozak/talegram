import { trpc, resolveBackendUrl } from "./trpc";

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

const backendUrl = resolveBackendUrl();

type BuildDownloadUrlOptions = {
  telegramUserId?: string | null;
};

export function buildFileDownloadUrl(fileId: string, options: BuildDownloadUrlOptions = {}): string {
  const normalized = fileId.trim();
  if (normalized.length === 0) {
    throw new Error("fileId must be a non-empty string");
  }

  const url = new URL(`/file/download/${encodeURIComponent(normalized)}`, `${backendUrl}/`);

  if (options.telegramUserId) {
    url.searchParams.set("telegramUserId", options.telegramUserId);
  }

  return url.toString();
}
