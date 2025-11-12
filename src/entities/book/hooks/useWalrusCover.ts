import { useEffect, useRef, useState } from "react";

import { fetchDecryptedBlob } from "@/shared/api/storage";
import { base64ToUint8Array } from "@/shared/lib/base64";

export function useWalrusCover(
  blobId?: string | null,
  mimeType?: string | null,
): string | null {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      if (!blobId) {
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
        setCoverUrl(null);
        return;
      }

      try {
        const blob = await fetchDecryptedBlob(blobId);
        if (isCancelled) {
          return;
        }

        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }

        const objectUrl = URL.createObjectURL(
          new Blob([base64ToUint8Array(blob.data)], {
            type: blob.mimeType ?? mimeType ?? "image/jpeg",
          }),
        );

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
  }, [blobId, mimeType]);

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

