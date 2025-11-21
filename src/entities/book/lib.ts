import type { SyntheticEvent } from "react";

const DEFAULT_FALLBACK_COVER = "/images/books/b33.jpg";

export function handleBookCoverError(
  event: SyntheticEvent<HTMLImageElement, Event>,
): void {
  const image = event.currentTarget;
  if (image.src === DEFAULT_FALLBACK_COVER) {
    return;
  }

  image.onerror = null;
  image.src = DEFAULT_FALLBACK_COVER;
}
