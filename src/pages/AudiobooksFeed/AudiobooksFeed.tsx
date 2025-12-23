import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Virtuoso } from "react-virtuoso";
import { Chip, Spinner, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";

import { catalogApi } from "@/entities/book/api";
import type { Book } from "@/entities/book/types";
import { BookRating } from "@/entities/book/components/BookRating";
import { useTMA } from "@/app/providers/TMAProvider";
import { getTelegramUserId } from "@/shared/lib/telegram";
import { buildBookFileDownloadUrl, buildBookPreviewDownloadUrl } from "@/shared/api/storage";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useTheme } from "@/app/providers/ThemeProvider";
import { Button } from "@/shared/ui/Button";
import {
  isBookLiked,
  loadLikedBookIds,
  persistLikedBookIds,
  toggleLikedBookId,
} from "@/shared/lib/likedBooks";
import { purchasesApi } from "@/entities/purchase/api";
import { useToast } from "@/shared/ui/ToastProvider";
import { shareURL } from "@tma.js/sdk";
import { buildMiniAppDirectLink } from "@/shared/lib/telegram";
import { useScrollToTop } from "@/shared/hooks/useScrollToTop.ts";

const PREVIEW_DURATION_SECONDS = 50;

function AudiobookSlide({
  book,
  isActive,
  audioUrl,
  unknownAuthorLabel,
  onScrollNext,
}: {
  book: Book;
  isActive: boolean;
  audioUrl: string | null;
  unknownAuthorLabel: string;
  onScrollNext: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  useScrollToTop();

  const { launchParams } = useTMA();
  const theme = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const likedBookIdsRef = useRef<Set<string>>(new Set());
  const [isLiked, setIsLiked] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [audioDuration, setAudioDuration] = useState(PREVIEW_DURATION_SECONDS);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const authors = useMemo(
    () => (book.authors?.length ? book.authors.join(", ") : unknownAuthorLabel),
    [book.authors, unknownAuthorLabel],
  );
  const telegramUserId = useMemo(
    () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
    [launchParams],
  );
  const primaryAudioBook = book.audioBooks?.[0] ?? null;
  const primaryAudioBookId = primaryAudioBook?.id ?? null;
  const hasAudiobook = Boolean(primaryAudioBook || book.audiobookFilePath);
  const hasFullAccess = isPurchased || book.price === 0;
  const formatTime = useCallback((value: number) => {
    const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
    const minutes = Math.floor(safeValue / 60);
    const seconds = Math.floor(safeValue % 60);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!telegramUserId || !book.id) {
      setIsPurchased(false);
      return undefined;
    }

    const checkPurchase = async () => {
      try {
        const status = await purchasesApi.getStatus({ bookId: book.id });
        if (!cancelled) {
          setIsPurchased(status.purchased);
        }
      } catch (error) {
        console.error("Failed to check purchase status", error);
        if (!cancelled) {
          setIsPurchased(false);
        }
      }
    };

    void checkPurchase();

    return () => {
      cancelled = true;
    };
  }, [book.id, telegramUserId]);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    audioElement.pause();
    setIsAudioPlaying(false);

    if (!isActive) {
      return;
    }

    audioElement.currentTime = 0;
    setCurrentTime(0);
    const playPromise = audioElement.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => setIsAudioPlaying(true))
        .catch((error) => {
          console.warn("Failed to autoplay audiobook", error);
        });
    } else {
      setIsAudioPlaying(true);
    }
  }, [audioUrl, isActive]);

  useEffect(() => () => {
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    setAudioDuration(PREVIEW_DURATION_SECONDS);
    setCurrentTime(0);
    setIsAudioPlaying(false);
  }, [audioUrl]);

  useEffect(() => {
    const likedSet = loadLikedBookIds(telegramUserId);
    likedBookIdsRef.current = likedSet;
    setIsLiked(isBookLiked(book.id, likedSet));
  }, [book.id, telegramUserId]);

  const handleToggleLike = useCallback(() => {
    const { liked, updated } = toggleLikedBookId(book.id, likedBookIdsRef.current);
    likedBookIdsRef.current = updated;
    setIsLiked(liked);
    persistLikedBookIds(updated, telegramUserId);
  }, [book.id, telegramUserId]);

  const resetPreview = useCallback(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    audioElement.currentTime = 0;
    setCurrentTime(0);

    if (isActive) {
      const playPromise = audioElement.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise
          .then(() => setIsAudioPlaying(true))
          .catch((error) => {
            setIsAudioPlaying(false);
            console.warn("Failed to restart preview", error);
          });
      } else {
        setIsAudioPlaying(!audioElement.paused);
      }
    } else {
      setIsAudioPlaying(false);
    }
  }, [isActive]);

  const handleAudioLoadedMetadata = useCallback(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : PREVIEW_DURATION_SECONDS;
    const limitedDuration = Math.min(duration, PREVIEW_DURATION_SECONDS);
    setAudioDuration(limitedDuration);
    setCurrentTime(Math.min(audioElement.currentTime, limitedDuration));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audioElement = audioRef.current;
    if (!audioElement) {
      return;
    }

    const time = Math.min(audioElement.currentTime, PREVIEW_DURATION_SECONDS);
    if (time >= PREVIEW_DURATION_SECONDS) {
      resetPreview();
      return;
    }

    setCurrentTime(time);
  }, [resetPreview]);

  const handleAudioPause = useCallback(() => {
    handleTimeUpdate();
    setIsAudioPlaying(false);
  }, [handleTimeUpdate]);

  const handleAudioPlay = useCallback(() => {
    setIsAudioPlaying(true);
  }, []);

  const handleAudioEnded = useCallback(() => {
    resetPreview();
  }, [resetPreview]);

  const handleManualSeek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const target = Number.parseFloat(event.target.value);
      const audioElement = audioRef.current;

      if (!audioElement || Number.isNaN(target)) {
        return;
      }

      const clamped = Math.min(Math.max(target, 0), audioDuration || PREVIEW_DURATION_SECONDS);

      try {
        audioElement.currentTime = clamped;
        setCurrentTime(clamped);
        if (audioElement.paused && isActive) {
          void audioElement.play();
        }
      } catch (error) {
        console.warn("Failed to set preview position", error);
      }
    },
    [audioDuration, isActive],
  );

  const handleShare = useCallback(() => {
    try {
      const deepLink = buildMiniAppDirectLink({ startParam: `book_${book.id}`, botUsername: "talegram_org_bot" });
      shareURL(deepLink ?? "", "Invite you to read book");
    } catch (err) {
      showToast(t("book.toast.linkFailed"));
      console.error(err);
    }
  }, [book.id, showToast, t]);

  const handleShareRead = useCallback(() => {
    try {
      const deepLink = buildMiniAppDirectLink({
        startParam: `reader_${book.id}_books_${book.price === 0 ? "" : "preview_1"}`,
        botUsername: "talegram_org_bot",
      });

      shareURL(deepLink ?? "", "Invite you to read book");
    } catch (err) {
      showToast(t("book.toast.linkFailed"));
      console.error(err);
    }
  }, [book.id, book.price, showToast, t]);

  const handleTogglePlayback = useCallback(() => {
    const audioElement = audioRef.current;
    if (!audioElement || !isActive) {
      return;
    }

    if (audioElement.paused) {
      const playPromise = audioElement.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.catch((error) => console.warn("Failed to resume audiobook preview", error));
      }
    } else {
      audioElement.pause();
      setIsAudioPlaying(false);
    }
  }, [isActive]);

  const handleTagClick = useCallback(
    (tag: string) => {
      navigate(`/search?q=${encodeURIComponent(`#${tag}`)}`);
    },
    [navigate],
  );

  const handleOpenBook = useCallback(() => {
    navigate(`/book/${encodeURIComponent(book.id)}`);
  }, [book.id, navigate]);

  const handleListen = useCallback(() => {
    if (!hasAudiobook) {
      showToast(t("book.audiobook.unavailable"));
      return;
    }

    if (!hasFullAccess) {
      showToast(t("book.toast.listenAccessRequired"));
      return;
    }

    const params = new URLSearchParams();
    if (primaryAudioBookId) {
      params.set("audioBookId", primaryAudioBookId);
    }

    const query = params.toString();
    navigate(`/listen/${encodeURIComponent(book.id)}/books${query ? `?${query}` : ""}`);
  }, [book.id, hasAudiobook, hasFullAccess, navigate, primaryAudioBookId, showToast, t]);

  const handleListenPreview = useCallback(() => {
    if (!hasAudiobook) {
      showToast(t("book.audiobook.unavailable"));
      return;
    }

    const params = new URLSearchParams({ preview: "1" });
    if (primaryAudioBookId) {
      params.set("audioBookId", primaryAudioBookId);
    }

    navigate(`/listen/${encodeURIComponent(book.id)}/books?${params.toString()}`);
  }, [book.id, hasAudiobook, navigate, primaryAudioBookId, showToast, t]);

  return (
    <div className="audiobook-slide">
      <img alt={book.title} className="audiobook-cover" src={buildBookFileDownloadUrl(book.id, "cover")} />
      <div className="audiobook-overlay">
        <div className="audiobook-meta" role="group" aria-label={t("book.bookInfo")}>
          <div className="audiobook-meta-header">
            <div className="audiobook-meta-titles">
              <Title weight="2" style={{ color: theme.text }}>
                {book.title}
              </Title>
              {authors ? (
                <Text weight="2" style={{ color: theme.subtitle }}>
                  {authors}
                </Text>
              ) : null}
            </div>
            <div className="audiobook-meta-actions">
              <Button aria-label={t("book.share")} mode="plain" onClick={handleShare}>
                🔗
              </Button>
              <Button
                aria-label={t(isLiked ? "book.actions.unlike" : "book.actions.like", { title: book.title })}
                mode="plain"
                onClick={handleToggleLike}
                aria-pressed={isLiked}
              >
                <span aria-hidden="true">{isLiked ? "❤️" : "💙"}</span>
              </Button>
            </div>
          </div>

          <div className="audiobook-meta-rating">
            <BookRating value={book.rating.average} votes={book.rating.votes} />
            <Chip mode="outline" style={{ fontWeight: 600 }}>
              {book.price} {book.currency} ⭐
            </Chip>
            {hasAudiobook ? (
              <Chip mode="outline" style={{ fontWeight: 600 }}>
                {t("book.audiobook.badge")}
              </Chip>
            ) : null}
          </div>

          {book.tags?.length ? (
            <div className="audiobook-meta-tags">
              {book.tags.map((tag) => (
                <Chip key={tag} mode="outline" onClick={() => handleTagClick(tag)}>
                  #{tag}
                </Chip>
              ))}
            </div>
          ) : null}

          {book.description ? (
            <div className="audiobook-meta-description">
              <Text style={{ color: theme.text }}>
                {showFullDescription || book.description.length <= 220
                  ? book.description
                  : `${book.description.slice(0, 220)}...`}
              </Text>
              {book.description.length > 220 ? (
                <Button mode="plain" onClick={() => setShowFullDescription((prev) => !prev)}>
                  {showFullDescription ? t("book.description.showLess") : t("book.description.showMore")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="audiobook-meta-controls">
            {hasFullAccess ? (
              <>
                  <Button
                      disabled={!audioUrl || !isActive}
                      mode="outline"
                      onClick={handleTogglePlayback}
                      size="m"
                  >
                      {t(isAudioPlaying ? "book.listen.pause" : "book.listen.play")}
                  </Button>
                <Button size="m" onClick={handleListen}>
                  {t("book.actions.listen")}
                </Button>
                <Button size="m" mode="outline" onClick={handleOpenBook}>
                  {t("book.actions.read")}
                </Button>

                <Button size="m" mode="outline" onClick={handleShareRead}>
                  {t("book.actions.share-read")}
                </Button>
              </>
            ) : (
              <>
                <Button size="m" onClick={handleListenPreview}>
                  {t("book.actions.previewAudio")}
                </Button>
                <Button size="m" mode="outline" onClick={handleOpenBook}>
                  {t("book.actions.preview")}
                </Button>
                <Button
                  disabled={!audioUrl || !isActive}
                  mode="outline"
                  onClick={handleTogglePlayback}
                  size="m"
                >
                  {t(isAudioPlaying ? "book.listen.pause" : "book.listen.play")}
                </Button>
                <Button size="m" mode="outline" onClick={handleShareRead}>
                  {t("book.actions.share-preview")}
                </Button>
              </>
            )}
          </div>

          {audioUrl ? (
            <div className="audiobook-progress" aria-label={t("book.actions.previewAudio")}>
              <input
                type="range"
                min={0}
                max={audioDuration || PREVIEW_DURATION_SECONDS}
                step={1}
                value={Math.min(currentTime, audioDuration)}
                onChange={handleManualSeek}
                aria-label={t("book.listen.seek")}
              />
              <div className="audiobook-progress-times">
                <Text>{formatTime(currentTime)}</Text>
                <Text>{formatTime(audioDuration)}</Text>
              </div>
            </div>
          ) : null}
          <button
            aria-label={t("audiobooks.scrollNext", { defaultValue: "Scroll to next slide" })}
            className="audiobook-scroll-indicator"
            onClick={onScrollNext}
            type="button"
          >
            <motion.svg
              animate={{ y: [0, 6, 0] }}
              className="audiobook-scroll-arrow"
              fill="none"
              stroke={theme.accent}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
              viewBox="0 0 24 24"
            >
              <path d="M12 4v16" />
              <path d="m7 15 5 5 5-5" />
            </motion.svg>
          </button>
        </div>
      </div>
      {audioUrl ? (
        <audio
          preload="auto"
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onDurationChange={handleAudioLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPause={handleAudioPause}
          onPlay={handleAudioPlay}
          onEnded={handleAudioEnded}
        />
      ) : null}
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
  const theme = useTheme();
  const virtuosoRef = useRef<HTMLDivElement | null>(null);

  const telegramUserId = useMemo(
    () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
    [launchParams],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const shuffleBooks = (items: Book[]) => {
      const array = [...items];
      for (let i = array.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    const load = async () => {
      try {
        const response = await catalogApi.listAudiobooks();
        if (!cancelled) {
          setBooks(shuffleBooks(response));
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
    (audioBookId: string | null, fallbackBookId?: string | null) => {
      const resourceId = audioBookId ?? fallbackBookId ?? null;
      if (!resourceId) {
        return null;
      }

      try {
        return buildBookPreviewDownloadUrl(resourceId, "audiobook", "books", { telegramUserId });
      } catch (err) {
        console.warn("Failed to build audiobook url", err);
        return null;
      }
    },
    [telegramUserId],
  );

  const handleScrollToNextSlide = useCallback(() => {
    const container = virtuosoRef.current;
    if (!container) {
      return;
    }

    const nextIndex = Math.min(activeIndex + 1, books.length - 1);
    const slideHeight = container.clientHeight || 0;
    const nextOffset = slideHeight * nextIndex;

    container.scrollTo({ top: nextOffset, behavior: "smooth" });
  }, [activeIndex, books.length]);

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
        itemContent={(index, book: unknown) => (
          <AudiobookSlide
            audioUrl={getAudioUrl((book as Book).audioBooks?.[0]?.id ?? null, (book as Book).id)}
            book={book as Book}
            isActive={index === activeIndex}
            onScrollNext={handleScrollToNextSlide}
            unknownAuthorLabel={t("audiobooks.unknownAuthor")}
          />
        )}
        ref={virtuosoRef}
        rangeChanged={(range) => setActiveIndex(range.start)}
        style={{ height: "100vh" }}
        totalCount={books.length}
      />
      <style>
        {`
          .audiobook-feed {
            height: 100vh;
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
         
          }
          .audiobook-cover {
            position: absolute;
            top: 5%;
            left: 50%;
            transform: translateX(-50%);
            width: 60%;
            height: 40%;
            object-fit: fit;
            border-radius: 20px;
            filter: brightness(0.6);
          }
          .audiobook-overlay {
            position: absolute;
            bottom: 20%;
            left: 0;
            width: 100%;
            padding: 24px 20px 96px;
            box-sizing: border-box;
            background: ${theme.background};
          }
          .audiobook-meta {
            max-width: 720px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .audiobook-meta-header {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            justify-content: space-between;
          }
          .audiobook-meta-titles {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
          }
          .audiobook-meta-actions {
            display: flex;
            gap: 4px;
          }
          .audiobook-meta-rating {
            display: none;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }
          .audiobook-meta-tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .audiobook-meta-description {
            display: none;
            flex-direction: column;
            gap: 8px;
          }
          .audiobook-meta-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .audiobook-scroll-indicator {
            background: transparent;
            border: none;
            display: flex;
            justify-content: center;
            padding-top: 8px;
            cursor: pointer;
          }
          .audiobook-scroll-indicator:focus-visible {
            outline: 2px solid ${theme.accent};
            outline-offset: 4px;
          }
          .audiobook-scroll-indicator:disabled {
            cursor: default;
            opacity: 0.6;
          }
          .audiobook-scroll-arrow {
            width: 32px;
            height: 48px;
          }
          .audiobook-progress {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 8px;
          }
          .audiobook-progress input[type="range"] {
            width: 100%;
          }
          .audiobook-progress-times {
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: ${theme.subtitle};
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
