import type { SyntheticEvent } from "react";

import type { Book } from "./types";

const DEFAULT_FALLBACK_COVER = "/images/books/b33.jpg";

function hasCoverData(coverUrl: string | undefined | null): coverUrl is string {
  return typeof coverUrl === "string" && coverUrl.trim().length > 0;
}

export function resolveBookCover(book: Pick<Book, "id" | "coverUrl">): string {
  if (hasCoverData(book.coverUrl)) {
    return book.coverUrl;
  }

  return `/images/books/${book.id}.jpg`;
}

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
