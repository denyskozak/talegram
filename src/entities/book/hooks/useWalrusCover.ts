import { useEffect, useRef, useState } from "react";

import { fetchBookFile } from "@/shared/api/storage";

type UseWalrusCoverParams = {
  bookId?: string | null;
  mimeType?: string | null;
  enabled?: boolean;
};

export function useWalrusCover(params: UseWalrusCoverParams): string | null {
  const { bookId, mimeType, enabled = true } = params;
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (!enabled || !bookId) {
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
        setCoverUrl(null);
        return;
      }

      try {
        const file = await fetchBookFile(bookId, "cover");
        if (isCancelled) {
          return;
        }

        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }

        const resolvedMimeType = file.mimeType ?? mimeType ?? "image/jpeg";
        const objectUrl = URL.createObjectURL(new Blob([file.data], { type: resolvedMimeType }));

        urlRef.current = objectUrl;
        setCoverUrl(objectUrl);
      } catch (error) {
        console.error("Failed to load book cover", error);
        if (!isCancelled) {
          setCoverUrl(null);
        }
      }
    };

    void load();

    return () => {
      isCancelled = true;
    };
  }, [bookId, enabled, mimeType]);

  useEffect(
    () => () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    },
    [],
  );

  return coverUrl;
}

