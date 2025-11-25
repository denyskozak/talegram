import { resolveBackendUrl } from "./trpc";

export type BookFileKind = "book" | "cover" | "audiobook";
export type DownloadResource = "books" | "proposals";

const backendUrl = resolveBackendUrl();

type BuildBookDownloadUrlOptions = {
  telegramUserId?: string | null;
};

export function buildBookFileDownloadUrl(
  bookId: string,
  fileKind: BookFileKind,
  resource: DownloadResource = "books",
  options: BuildBookDownloadUrlOptions = {},
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

export function buildBookPreviewDownloadUrl(
  bookId: string,
  fileKind: Exclude<BookFileKind, "cover">,
  resource: DownloadResource = "books",
  options: BuildBookDownloadUrlOptions = {},
): string {
  const normalized = bookId.trim();
  if (normalized.length === 0) {
    throw new Error("bookId must be a non-empty string");
  }

  const resourcePath = resource === "proposals" ? "propsals" : "books";
  const extension = fileKind === "audiobook" ? "mp3" : "epub";
  const url = new URL(
    `/preview/${resourcePath}/${encodeURIComponent(normalized)}/${fileKind}/preview.${extension}`,
    `${backendUrl}/`,
  );

  if (options.telegramUserId) {
    url.searchParams.set("telegramUserId", options.telegramUserId);
  }

  return url.toString();
}
