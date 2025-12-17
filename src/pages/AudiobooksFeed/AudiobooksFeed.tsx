import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { Spinner, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { catalogApi } from "@/entities/book/api";
import type { Book } from "@/entities/book/types";
import { useTMA } from "@/app/providers/TMAProvider";
import { getTelegramUserId } from "@/shared/lib/telegram";
import { buildBookPreviewDownloadUrl } from "@/shared/api/storage";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useTheme } from "@/app/providers/ThemeProvider";

function AudiobookSlide({
  book,
  isActive,
  audioUrl,
  unknownAuthorLabel,
}: {
  book: Book;
  isActive: boolean;
  audioUrl: string | null;
  unknownAuthorLabel: string;
}): JSX.Element {
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const authors = useMemo(
    () => (book.authors?.length ? book.authors.join(", ") : unknownAuthorLabel),
    [book.authors, unknownAuthorLabel],
  );

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    audioElement.pause();

    if (!isActive) {
      return;
    }

    audioElement.currentTime = 0;
    const playPromise = audioElement.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.warn("Failed to autoplay audiobook", error);
      });
    }
  }, [audioUrl, isActive]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  return (
    <div className="audiobook-slide">
      <img alt={book.title} className="audiobook-cover" src={book.coverUrl} />
      <div className="audiobook-overlay">
        <div className="audiobook-meta">
          <Title weight="2" style={{ color: theme.text }}>
            {book.title}
          </Title>
          {authors ? (
            <Text weight="2" style={{ color: theme.subtitle }}>
              {authors}
            </Text>
          ) : null}
        </div>
      </div>
      {audioUrl ? <audio preload="auto" ref={audioRef} src={audioUrl} /> : null}
    </div>
  );
}

export default function AudiobooksFeed(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { launchParams } = useTMA();
  const [books, setBooks] = useState<Book[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const telegramUserId = useMemo(
    () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
    [launchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const response = await catalogApi.listAudiobooks();
        if (!cancelled) {
          setBooks(response);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load audiobooks", err);
          setError(t("audiobooks.error"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [i18n.language, refreshToken, t]);

  const handleRetry = useCallback(() => setRefreshToken((prev) => prev + 1), []);

  const getAudioUrl = useCallback(
    (bookId: string) => {
      try {
        return buildBookPreviewDownloadUrl(bookId, "audiobook", "books", { telegramUserId });
      } catch (err) {
        console.warn("Failed to build audiobook url", err);
        return null;
      }
    },
    [telegramUserId],
  );

  if (error) {
    return <ErrorBanner message={error} onRetry={handleRetry} />;
  }

  if (isLoading) {
    return (
      <div className="audiobook-loader">
        <Spinner size="l" />
        <Text>{t("audiobooks.loading")}</Text>
      </div>
    );
  }

  if (books.length === 0) {
    return <EmptyState description={t("audiobooks.empty.description")} title={t("audiobooks.empty.title")} />;
  }

  return (
    <div className="audiobook-feed">
      <Virtuoso
        className="audiobook-virtuoso"
        data={books}
        itemContent={(index, book) => (
          <AudiobookSlide
            audioUrl={getAudioUrl(book.id)}
            book={book}
            isActive={index === activeIndex}
            unknownAuthorLabel={t("audiobooks.unknownAuthor")}
          />
        )}
        rangeChanged={(range) => setActiveIndex(range.start)}
        style={{ height: "100vh" }}
        totalCount={books.length}
      />
      <style>
        {`
          .audiobook-feed {
            height: 100vh;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.65) 50%, rgba(0, 0, 0, 0.85) 100%);
          }
          .audiobook-virtuoso {
            scroll-snap-type: y mandatory;
            overscroll-behavior: contain;
          }
          .audiobook-slide {
            height: 100vh;
            scroll-snap-align: start;
            position: relative;
            display: flex;
            align-items: flex-end;
            justify-content: flex-start;
            overflow: hidden;
            background: #000;
          }
          .audiobook-cover {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.6);
          }
          .audiobook-overlay {
            position: relative;
            width: 100%;
            padding: 24px 20px 56px;
            box-sizing: border-box;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.75) 60%, rgba(0, 0, 0, 0.95) 100%);
          }
          .audiobook-meta {
            max-width: 720px;
          }
          .audiobook-loader {
            height: 100vh;
            display: grid;
            place-items: center;
            gap: 12px;
          }
        `}
      </style>
    </div>
  );
}
