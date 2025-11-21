import { resolveBackendUrl } from "./trpc";

export type BookFileKind = "book" | "cover" | "audiobook";
export type DownloadResource = "books" | "proposals";

export type DecryptedFile = {
  bookId: string;
  fileKind: BookFileKind;
  fileName: string | null;
  mimeType: string | null;
  data: ArrayBuffer;
};

type FetchBookFileOptions = {
  telegramUserId?: string | null;
  signal?: AbortSignal;
};

export async function fetchBookFile(
  bookId: string,
  fileKind: BookFileKind,
  options: FetchBookFileOptions = {},
): Promise<DecryptedFile> {
  const downloadUrl = buildBookFileDownloadUrl(bookId, fileKind, {
    telegramUserId: options.telegramUserId ?? undefined,
  });
  const response = await fetch(downloadUrl, {
    method: "GET",
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
    bookId,
    fileKind,
    fileName,
    mimeType,
    data,
  };
}

const backendUrl = resolveBackendUrl();

type BuildBookDownloadUrlOptions = {
  telegramUserId?: string | null;
};

export function buildBookFileDownloadUrl(
  bookId: string,
  fileKind: BookFileKind,
  options: BuildBookDownloadUrlOptions = {},
  resource: DownloadResource = "books",
): string {
  const normalized = bookId.trim();
  if (normalized.length === 0) {
    throw new Error("bookId must be a non-empty string");
  }

  const resourcePath = resource === "proposals" ? "propsals" : "books";
  const url = new URL(
    `/${resourcePath}/${encodeURIComponent(normalized)}/${fileKind}/download.epub`,
    `${backendUrl}/`,
  );

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
