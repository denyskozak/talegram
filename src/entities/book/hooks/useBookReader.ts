import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDecryptedFile } from "@/shared/api/storage";
import { base64ToUint8Array } from "@/shared/lib/base64";

type EnsureBookFileUrlOptions = {
  mimeType?: string | null;
};

type OpenReaderOptions =
  | { preview: true }
  | {
      preview?: false;
      fileId?: string | null;
      mimeType?: string | null;
    };

type UseBookReaderOptions = {
  mimeType?: string | null;
};

export function useBookReader(options: UseBookReaderOptions = {}) {
  const currentFileIdRef = useRef<string | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [bookFileUrl, setBookFileUrl] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const resetFile = useCallback(() => {
    currentFileIdRef.current = null;
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
    setBookFileUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      resetFile();
    };
  }, [resetFile]);

  const ensureBookFileUrl = useCallback(
    async (fileId: string, override: EnsureBookFileUrlOptions = {}): Promise<string | null> => {
      if (!fileId) {
        return null;
      }

      if (currentFileIdRef.current === fileId && fileUrlRef.current) {
        const cachedUrl = fileUrlRef.current;
        setBookFileUrl(cachedUrl);
        return cachedUrl;
      }

      try {
        const blob = await fetchDecryptedFile(fileId);
        if (fileUrlRef.current) {
          URL.revokeObjectURL(fileUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(
          new Blob([base64ToUint8Array(blob.data)], {
            type: blob.mimeType ?? override.mimeType ?? options.mimeType ?? "application/octet-stream",
          }),
        );

        currentFileIdRef.current = fileId;
        fileUrlRef.current = objectUrl;
        setBookFileUrl(objectUrl);
        return objectUrl;
      } catch (error) {
        console.error("Failed to load book file", error);
        resetFile();
        return null;
      }
    },
    [options.mimeType, resetFile],
  );

  const openReader = useCallback(
    async (params?: OpenReaderOptions): Promise<boolean> => {
      if (params?.preview === true) {
        setIsPreviewMode(true);
        setIsReading(true);
        return true;
      }

      const fileId = params?.fileId;
      if (!fileId) {
        setIsPreviewMode(true);
        setIsReading(true);
        return true;
      }

      const url = await ensureBookFileUrl(fileId, { mimeType: params?.mimeType });
      if (!url) {
        return false;
      }

      setIsPreviewMode(false);
      setIsReading(true);
      return true;
    },
    [ensureBookFileUrl],
  );

  const closeReader = useCallback(() => {
    setIsPreviewMode(false);
    setIsReading(false);
  }, []);

  return {
    bookFileUrl,
    ensureBookFileUrl,
    openReader,
    closeReader,
    isReading,
    isPreviewMode,
    resetFile,
  } as const;
}
