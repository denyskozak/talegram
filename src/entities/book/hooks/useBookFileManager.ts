import { useCallback, useEffect, useRef, useState } from "react";

import { downloadFile } from "@telegram-apps/sdk-react";

import { fetchDecryptedFile } from "@/shared/api/storage";
import { base64ToUint8Array } from "@/shared/lib/base64";

export type EnsureBookFileParams = {
  fileId?: string | null;
  mimeType?: string | null;
};

export type DownloadBookFileParams = EnsureBookFileParams & {
  fileName?: string | null;
  title?: string | null;
};

export type UseBookFileManagerOptions = {
  defaultMimeType?: string | null;
};

const FALLBACK_MIME_TYPE = "application/octet-stream";
const FALLBACK_FILE_NAME = "book.pdf";

function resolveFileName({ fileName, title }: Pick<DownloadBookFileParams, "fileName" | "title">): string {
  const trimmedFileName = fileName?.trim();
  if (trimmedFileName) {
    return trimmedFileName;
  }

  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    return `${trimmedTitle}.pdf`;
  }

  return FALLBACK_FILE_NAME;
}

export function useBookFileManager({ defaultMimeType }: UseBookFileManagerOptions = {}) {
  const currentFileIdRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [bookFileUrl, setBookFileUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const reset = useCallback(() => {
    currentFileIdRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setBookFileUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const ensureBookFileUrl = useCallback(
    async ({ fileId, mimeType }: EnsureBookFileParams): Promise<string | null> => {
      if (!fileId) {
        return null;
      }

      if (currentFileIdRef.current === fileId && objectUrlRef.current) {
        setBookFileUrl(objectUrlRef.current);
        return objectUrlRef.current;
      }

      try {
        const response = await fetchDecryptedFile(fileId);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        const effectiveMimeType = response.mimeType ?? mimeType ?? defaultMimeType ?? FALLBACK_MIME_TYPE;
        const objectUrl = URL.createObjectURL(
          new Blob([base64ToUint8Array(response.data)], {
            type: effectiveMimeType,
          }),
        );

        currentFileIdRef.current = fileId;
        objectUrlRef.current = objectUrl;
        setBookFileUrl(objectUrl);
        return objectUrl;
      } catch (error) {
        console.error("Failed to load book file", error);
        currentFileIdRef.current = null;
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        setBookFileUrl(null);
        return null;
      }
    },
    [defaultMimeType],
  );

  const downloadBookFile = useCallback(
    async ({ fileId, fileName, title, mimeType }: DownloadBookFileParams): Promise<boolean> => {
      if (!fileId) {
        return false;
      }

      setIsDownloading(true);
      try {
        const url = await ensureBookFileUrl({ fileId, mimeType });
        if (!url) {
          return false;
        }

        const resolvedFileName = resolveFileName({ fileName, title });

        if (downloadFile.isAvailable()) {
          await downloadFile(url, resolvedFileName);
        } else {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.rel = "noreferrer";
          anchor.download = resolvedFileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }

        return true;
      } catch (error) {
        console.error("Failed to download book", error);
        return false;
      } finally {
        setIsDownloading(false);
      }
    },
    [ensureBookFileUrl],
  );

  return { ensureBookFileUrl, downloadBookFile, bookFileUrl, isDownloading, reset } as const;
}
