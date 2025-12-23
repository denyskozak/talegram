const STORAGE_PREFIX = 'book_progress';

export type BookProgressKind = 'reader_location' | 'audio_position' | 'audio_voice';

function getStorageKey(kind: BookProgressKind, bookId?: string): string | null {
    if (typeof bookId !== 'string') {
        return null;
    }

    const trimmedId = bookId.trim();
    if (trimmedId.length === 0) {
        return null;
    }

    return `${STORAGE_PREFIX}_${kind}_${trimmedId}`;
}

export function getStoredBookProgress(
    kind: BookProgressKind,
    bookId: string | undefined,
    fallback: string,
): string {
    const storageKey = getStorageKey(kind, bookId);
    if (!storageKey || typeof window === 'undefined') {
        return fallback;
    }

    try {
        const stored = window.localStorage.getItem(storageKey);
        return stored ?? fallback;
    } catch (error) {
        console.warn('Failed to read stored book progress', error);
        return fallback;
    }
}

export function setStoredBookProgress(
    kind: BookProgressKind,
    bookId: string | undefined,
    value: string,
): void {
    const storageKey = getStorageKey(kind, bookId);
    if (!storageKey || typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(storageKey, value);
    } catch (error) {
        console.warn('Failed to persist book progress', error);
    }
}
