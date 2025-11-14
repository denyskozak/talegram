import { resolveBackendUrl } from "./trpc";

export type DecryptedFile = {
  fileId: string;
  fileName: string | null;
  mimeType: string | null;
  data: ArrayBuffer;
};

type FetchDecryptedFileOptions = {
  telegramUserId?: string | null;
  signal?: AbortSignal;
};

export async function fetchDecryptedFile(
  fileId: string,
  options: FetchDecryptedFileOptions = {},
): Promise<DecryptedFile> {
  const downloadUrl = buildFileDownloadUrl(fileId, { telegramUserId: options.telegramUserId ?? undefined });
  const response = await fetch(downloadUrl, {
    method: "GET",
    // credentials: "include",
    signal: options.signal,
      headers: {
          "ngrok-skip-browser-warning": "true",
      },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch decrypted file: ${response.status} ${response.statusText}`);
  }

  const data = await response.arrayBuffer();
  const mimeType = response.headers.get("Content-Type");
  const fileName = parseFileNameFromContentDisposition(
    response.headers.get("Content-Disposition"),
  );

  return {
    fileId,
    fileName,
    mimeType,
    data,
  };
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

function parseFileNameFromContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const filenameStarMatch = header.match(/filename\*=([^;]+)/i);
  if (filenameStarMatch) {
    const value = filenameStarMatch[1].trim();
    const parts = value.split("''", 2);
    if (parts.length === 2) {
      const encodedFileName = parts[1];
      try {
        return decodeURIComponent(encodedFileName);
      } catch (error) {
        console.warn("Failed to decode RFC 5987 filename", error);
      }
    } else {
      try {
        return decodeURIComponent(value.replace(/^"|"$/g, ""));
      } catch (error) {
        console.warn("Failed to decode filename", error);
      }
    }
  }

  const filenameMatch = header.match(/filename="?([^";]+)"?/i);
  if (filenameMatch) {
    const candidate = filenameMatch[1].trim();
    if (candidate) {
      return candidate;
    }
  }

  return null;
}
