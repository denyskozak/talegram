import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button, Card, Chip, Modal, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { catalogApi } from "@/entities/book/api";
import type { Book, ID } from "@/entities/book/types";
import { BookRating } from "@/entities/book/components/BookRating";
import { SimilarCarousel } from "@/widgets/SimilarCarousel/SimilarCarousel";
import { ReviewsList } from "@/widgets/ReviewsList/ReviewsList";
import { useScrollToTop } from "@/shared/hooks/useScrollToTop";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useToast } from "@/shared/ui/ToastProvider";
import { ReadingOverlay } from "./ReadingOverlay";
import { BookPageSkeleton } from "./BookPageSkeleton";

export default function BookPage(): JSX.Element {
  const { id } = useParams<{ id: ID }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const reviewsRef = useRef<HTMLDivElement | null>(null);
  const loaderTimeoutRef = useRef<number | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [similar, setSimilar] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<"buy" | "subscribe" | null>(null);
  const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useScrollToTop([id]);

  const loadBook = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const item = await catalogApi.getBook(id);
      setBook(item);
      const similarBooksResponse = await catalogApi.listBooks({
        categoryId: item.categories[0],
        limit: 12,
      });
      setSimilar(similarBooksResponse.items.filter((entry) => entry.id !== item.id).slice(0, 6));
    } catch (err) {
      console.error(err);
      setError(t("errors.loadBook"));
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast(t("book.toast.linkCopied"));
    } catch (err) {
      showToast(t("book.toast.linkFailed"));
      console.error(err);
    }
  }, [showToast, t]);

  const handleScrollToReviews = useCallback(() => {
    reviewsRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handlePreview = useCallback(() => {
    if (!book) {
      return;
    }

    setIsPreviewMode(true);
    setIsReading(true);
  }, [book]);

  const handleRead = useCallback(() => {
    if (!book) {
      return;
    }

    setIsPreviewMode(false);
    setIsReading(true);
  }, [book]);

  const handleCloseReader = useCallback(() => {
    setIsPreviewMode(false);
    setIsReading(false);
  }, []);

  const handleReviewCreated = useCallback(() => {
    setBook((prev) => (prev ? { ...prev, reviewsCount: prev.reviewsCount + 1 } : prev));
  }, []);

  const handleDownload = useCallback(() => {
    if (!id) {
      return;
    }

    // window.location.href = `/api/books/${id}/download`;
  }, [id]);

  const handleMockAction = useCallback(
    (action: "buy" | "subscribe") => {
      if (!book || isActionLoading) {
        return;
      }

      setActiveAction(action);
      setIsActionLoading(true);

      if (loaderTimeoutRef.current) {
        window.clearTimeout(loaderTimeoutRef.current);
      }

      loaderTimeoutRef.current = window.setTimeout(() => {
        setIsActionLoading(false);
        setPurchaseModalOpen(true);
      }, 800);
    },
    [book, isActionLoading],
  );

  const handleConfirmPurchase = useCallback(() => {
    setPurchaseModalOpen(false);
    setIsPurchased(true);
    setIsPreviewMode(false);
    setActiveAction(null);
    setIsActionLoading(false);
    showToast(t("book.toast.accessGranted"));
  }, [showToast, t]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setPurchaseModalOpen(open);

      if (!open && !isPurchased) {
        setActiveAction(null);
      }
    },
    [isPurchased],
  );

  useEffect(() => {
    return () => {
      if (loaderTimeoutRef.current) {
        window.clearTimeout(loaderTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loaderTimeoutRef.current) {
      window.clearTimeout(loaderTimeoutRef.current);
    }

    setIsPurchased(false);
    setActiveAction(null);
    setPurchaseModalOpen(false);
    setIsActionLoading(false);
    setIsPreviewMode(false);
    setIsReading(false);
  }, [id]);

  useEffect(() => {
    if (!isPurchased && isReading && !isPreviewMode) {
      setIsReading(false);
    }
  }, [isPurchased, isPreviewMode, isReading]);

  useEffect(() => {
    void loadBook();
  }, [loadBook]);

  if (!id) {
    return (
      <ErrorBanner
        message={t("errors.bookNotFound")}
        onRetry={() => navigate("/")}
        actionLabel={t("buttons.goHome")}
      />
    );
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={loadBook} />;
  }

  if (isLoading || !book) {
    return <BookPageSkeleton />;
  }

  const actionTitle =
    activeAction === "subscribe" ? t("book.modalTitle.subscribe") : t("book.modalTitle.buy");

  return (
    <>
      <main style={{ margin: "0 auto", maxWidth: 720, paddingBottom: 96 }}>
        <div style={{ position: "relative" }}>
          <div style={{ padding: 16, gap: 16, display: "flex", flexDirection: 'column' }}>
              <div>
                  <Title level="1" weight="2">
                      {book.title}
                  </Title>
                  <div style={{ color: "var(--app-subtitle-color)" }}>{book.authors.join(", ")}</div>
                  <Button
                      aria-label={t("book.share")}
                      mode="plain"
                      onClick={handleShare}
                      style={{ position: "absolute", top: 12, right: 12 }}
                  >
                      🔗
                  </Button>
              </div>
              <Card style={{ borderRadius: 24, margin: '0 auto', overflow: "hidden",  width: '80vw' }}>
              <div style={{ position: "relative", aspectRatio: "10 / 12" }}>
                <img
                      src={`/images/books/${book.id}.jpg`}
                      alt={t("book.coverAlt", { title: book.title })}
                      onError={event => event.currentTarget.src='/images/books/b33.jpg' }
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                </Card>
              </div>
            </div>
            <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 16 }}>
             <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {book.tags.map((tag) => (
                  <Chip key={tag} mode="outline">
                    #{tag}
                  </Chip>
                ))}
              </div>
              <Card
                onClick={handleScrollToReviews}
                style={{ padding: 16, borderRadius: 20, cursor: "pointer" }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => event.key === "Enter" && handleScrollToReviews()}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <BookRating value={book.rating.average} votes={book.rating.votes} />
                    </div>
                    <Chip mode="outline" style={{ fontWeight: 600 }}>
                      {book.priceStars} ⭐
                    </Chip>
                  </div>
                  <div style={{ color: "var(--app-subtitle-color)" }}>
                    {t("book.reviewsCount", { count: book.reviewsCount })}
                  </div>
                </div>
              </Card>
              {isPurchased ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button size="l" onClick={handleRead}>
                    {t("book.actions.read")}
                  </Button>
                  <Button size="l" mode="outline" onClick={handleDownload}>
                    {t("book.actions.download")}
                  </Button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button
                    size="l"
                    loading={isActionLoading && activeAction === "buy"}
                    disabled={isActionLoading}
                    onClick={() => handleMockAction("buy")}
                  >
                    {t("book.actions.buy")}
                  </Button>
                  <Button
                    size="l"
                    mode="outline"
                    loading={isActionLoading && activeAction === "subscribe"}
                    disabled={isActionLoading}
                    onClick={() => handleMockAction("subscribe")}
                  >
                    {t("book.actions.subscribe")}
                  </Button>
                  <Button size="l" mode="outline" disabled={isActionLoading} onClick={handlePreview}>
                    {t("book.actions.preview")}
                  </Button>
                </div>
              )}
              <Card style={{ padding: 16, borderRadius: 20 }}>
                <Title level="3" weight="2" style={{ marginBottom: 12 }}>
                  {t("book.description.title")}
                </Title>
                <p style={{ lineHeight: 1.6 }}>
                  {showFullDescription || book.description.length <= 280
                    ? book.description
                    : `${book.description.slice(0, 280)}...`}
                </p>
                <Button mode="plain" onClick={() => setShowFullDescription((prev) => !prev)}>
                  {showFullDescription
                    ? t("book.description.showLess")
                    : t("book.description.showMore")}
                </Button>
              </Card>
              <section
                ref={reviewsRef}
                aria-label={t("book.reviewsSection")}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <Title level="2" weight="2">
                  {t("book.reviewsSection")}
                </Title>
                <ReviewsList api={catalogApi} bookId={book.id} onReviewCreated={handleReviewCreated} />
              </section>
              <section
                aria-label={t("book.similarSection")}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <Title level="2" weight="2">
                  {t("book.similarSection")}
                </Title>
                {similar.length === 0 ? (
                  <EmptyState
                    title={t("book.similarEmptyTitle")}
                    description={t("book.similarEmptyDescription")}
                  />
                ) : (
                  <SimilarCarousel books={similar} onSelect={(bookId) => navigate(`/book/${bookId}`)} />
                )}
              </section>
        </div>
      </main>
      <Modal open={isPurchaseModalOpen} onOpenChange={handleModalOpenChange}>
        <Modal.Header>{actionTitle}</Modal.Header>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            {activeAction === "subscribe"
              ? t("book.subscribeDescription")
              : t("book.buyDescription")}
          </p>
          {book && (
            <Card style={{ padding: 12, borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{book.title}</span>
                <span style={{ fontWeight: 600 }}>{book.priceStars} ⭐</span>
              </div>
            </Card>
          )}
          <Button size="l" mode="filled" onClick={handleConfirmPurchase}>
            {t("book.actions.confirm")}
          </Button>
        </div>
      </Modal>
      {book && isReading && <ReadingOverlay book={book} onClose={handleCloseReader} />}
    </>
  );
}
