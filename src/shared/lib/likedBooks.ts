const STORAGE_PREFIX = "talegram:liked-books";

function resolveStorageKey(telegramUserId?: string | null): string {
  const userKey = typeof telegramUserId === "string" && telegramUserId.trim().length > 0
    ? telegramUserId.trim()
    : "guest";

  return `${STORAGE_PREFIX}:${userKey}`;
}

function sanitizeBookId(bookId: string): string {
  return bookId.trim();
}

export function loadLikedBookIds(telegramUserId?: string | null): Set<string> {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const stored = window.localStorage.getItem(resolveStorageKey(telegramUserId));
    if (!stored) {
      return new Set<string>();
    }

    const parsed = JSON.parse(stored) as unknown;
    const likedIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];

    return new Set(likedIds.map(sanitizeBookId));
  } catch (error) {
    console.error("Failed to load liked books", error);
    return new Set<string>();
  }
}

export function persistLikedBookIds(
  likedIds: Set<string>,
  telegramUserId?: string | null,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(Array.from(likedIds));
    window.localStorage.setItem(resolveStorageKey(telegramUserId), serialized);
  } catch (error) {
    console.error("Failed to store liked books", error);
  }
}

export function isBookLiked(bookId: string, likedIds: Set<string>): boolean {
  if (bookId.length === 0) {
    return false;
  }

  return likedIds.has(sanitizeBookId(bookId));
}

export function toggleLikedBookId(
  bookId: string,
  likedIds: Set<string>,
): { liked: boolean; updated: Set<string> } {
  const normalizedId = sanitizeBookId(bookId);
  const updated = new Set(likedIds);

  if (normalizedId.length === 0) {
    return { liked: false, updated };
  }

  if (updated.has(normalizedId)) {
    updated.delete(normalizedId);
    return { liked: false, updated };
  }

  updated.add(normalizedId);
  return { liked: true, updated };
}
