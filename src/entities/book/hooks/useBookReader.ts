import { useCallback, useEffect, useRef, useState } from "react";

import { fetchBookFile } from "@/shared/api/storage";

type EnsureBookFileUrlOptions = {
  mimeType?: string | null;
};

type OpenReaderOptions =
  | { preview: true }
  | {
      preview?: false;
      bookId?: string | null;
      mimeType?: string | null;
    };

type UseBookReaderOptions = {
  mimeType?: string | null;
  telegramUserId?: string | null;
};

export function useBookReader(options: UseBookReaderOptions = {}) {
  const { mimeType: defaultMimeType, telegramUserId } = options;
  const currentBookIdRef = useRef<string | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const [bookFileUrl, setBookFileUrl] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isReaderLoading, setIsReaderLoading] = useState(false);

  const resetFile = useCallback(() => {
    currentBookIdRef.current = null;
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
    async (bookId: string, override: EnsureBookFileUrlOptions = {}): Promise<string | null> => {
      if (!bookId) {
        return null;
      }

      if (currentBookIdRef.current === bookId && fileUrlRef.current) {
        const cachedUrl = fileUrlRef.current;
        setBookFileUrl(cachedUrl);
        return cachedUrl;
      }

      try {
        const file = await fetchBookFile(bookId, "book", { telegramUserId });
        if (fileUrlRef.current) {
          URL.revokeObjectURL(fileUrlRef.current);
        }

        const resolvedMimeType =
          file.mimeType ?? override.mimeType ?? defaultMimeType ?? "application/octet-stream";

        const objectUrl = URL.createObjectURL(new Blob([file.data], { type: resolvedMimeType }));

        currentBookIdRef.current = bookId;
        fileUrlRef.current = objectUrl;
        setBookFileUrl(objectUrl);
        return objectUrl;
      } catch (error) {
        console.error("Failed to load book file", error);
        resetFile();
        return null;
      }
    },
    [defaultMimeType, resetFile, telegramUserId],
  );

  const openReader = useCallback(
    async (params?: OpenReaderOptions): Promise<boolean> => {
      if (params?.preview === true) {
        setIsPreviewMode(true);
        setIsReading(true);
        return true;
      }

      const bookId = params?.bookId;
      if (!bookId) {
        setIsPreviewMode(true);
        setIsReading(true);
        return true;
      }

      setIsReaderLoading(true);
      try {
        const url = await ensureBookFileUrl(bookId, { mimeType: params?.mimeType });
        if (!url) {
          return false;
        }

        setIsPreviewMode(false);
        setIsReading(true);
        return true;
      } finally {
        setIsReaderLoading(false);
      }
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
    isReaderLoading,
  } as const;
}
