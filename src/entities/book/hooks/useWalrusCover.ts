import { useEffect, useRef, useState } from "react";

import { fetchDecryptedFile } from "@/shared/api/storage";

export function useWalrusCover(
  fileId?: string | null,
  mimeType?: string | null,
): string | null {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (!fileId) {
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
        setCoverUrl(null);
        return;
      }

      try {
        const file = await fetchDecryptedFile(fileId);
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
  }, [fileId, mimeType]);

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

