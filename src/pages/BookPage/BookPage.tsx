import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button, Card, Chip, Modal, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { catalogApi } from "@/entities/book/api";
import { handleBookCoverError, resolveBookCover } from "@/entities/book/lib";
import { useWalrusCover } from "@/entities/book/hooks/useWalrusCover";
import type { Book, ID } from "@/entities/book/types";
import { paymentsApi } from "@/entities/payment/api";
import type { Invoice } from "@/entities/payment/types";
import { purchasesApi } from "@/entities/purchase/api";
import type { PurchaseDetails } from "@/entities/purchase/types";
import { BookRating } from "@/entities/book/components/BookRating";
import { useTMA } from "@/app/providers/TMAProvider";
import { SimilarCarousel } from "@/widgets/SimilarCarousel/SimilarCarousel";
import { ReviewsList } from "@/widgets/ReviewsList/ReviewsList";
import { useScrollToTop } from "@/shared/hooks/useScrollToTop";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useToast } from "@/shared/ui/ToastProvider";
import { fetchDecryptedBlob } from "@/shared/api/storage";
import { base64ToUint8Array } from "@/shared/lib/base64";
import { ReadingOverlay } from "./ReadingOverlay";
import { BookPageSkeleton } from "./BookPageSkeleton";

export default function BookPage(): JSX.Element {
  const { id } = useParams<{ id: ID }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { launchParams } = useTMA();
  const { t } = useTranslation();
  const reviewsRef = useRef<HTMLDivElement | null>(null);
  const loaderTimeoutRef = useRef<number | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [similar, setSimilar] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isPurchased, setIsPurchased] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetails | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<"buy" | "subscribe" | null>(null);
  const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isConfirmingPurchase, setIsConfirmingPurchase] = useState(false);
  const invoiceStatusRef = useRef<'paid' | 'failed' | 'cancelled' | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const currentBookBlobIdRef = useRef<string | null>(null);
  const bookFileUrlRef = useRef<string | null>(null);
  const [bookFileUrl, setBookFileUrl] = useState<string | null>(null);
  const autoReadTriggeredRef = useRef(false);

  useScrollToTop([id]);

  const walrusCover = useWalrusCover(book?.coverWalrusBlobId, book?.coverMimeType);

  useEffect(
    () => () => {
      if (bookFileUrlRef.current) {
        URL.revokeObjectURL(bookFileUrlRef.current);
        bookFileUrlRef.current = null;
      }
    },
    [],
  );
    console.log("launchParams?.tgWebAppData?: ", launchParams?.tgWebAppData);
  const telegramUserId = useMemo(() => {
    const user = launchParams?.tgWebAppData?.user;
    const rawId = user?.id;

    if (typeof rawId === "number") {
      return rawId.toString(10);
    }

    if (typeof rawId === "string" && rawId.trim().length > 0) {
      return rawId.trim();
    }

    return undefined;
  }, [launchParams]);

  const loadBook = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const item = await catalogApi.getBook(id, { telegramUserId });
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
  }, [id, t, telegramUserId]);

  const refreshPurchaseStatus = useCallback(async () => {
    if (!id || !telegramUserId) {
      setIsPurchased(false);
      setPurchaseDetails(null);
      return;
    }

    try {
      const status = await purchasesApi.getStatus({ bookId: id, telegramUserId });
      setIsPurchased(status.purchased);
      setPurchaseDetails(status.details);
    } catch (err) {
      console.error(err);
    }
  }, [id, telegramUserId]);

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

  const ensureBookFileUrl = useCallback(
    async (blobId: string): Promise<string | null> => {
      if (!blobId) {
        return null;
      }

      if (currentBookBlobIdRef.current === blobId && bookFileUrlRef.current) {
        setBookFileUrl(bookFileUrlRef.current);
        return bookFileUrlRef.current;
      }

      try {
        const blob = await fetchDecryptedBlob(blobId);
        if (bookFileUrlRef.current) {
          URL.revokeObjectURL(bookFileUrlRef.current);
        }

        const objectUrl = URL.createObjectURL(
          new Blob([base64ToUint8Array(blob.data)], {
            type: blob.mimeType ?? book?.mimeType ?? "application/octet-stream",
          }),
        );

        currentBookBlobIdRef.current = blobId;
        bookFileUrlRef.current = objectUrl;
        setBookFileUrl(objectUrl);
        return objectUrl;
      } catch (error) {
        console.error("Failed to load book file", error);
        currentBookBlobIdRef.current = null;
        if (bookFileUrlRef.current) {
          URL.revokeObjectURL(bookFileUrlRef.current);
          bookFileUrlRef.current = null;
        }
        setBookFileUrl(null);
        return null;
      }
    },
    [book?.mimeType],
  );

  const handleRead = useCallback(async () => {
    if (!book) {
      return;
    }

    if (!isPurchased || !purchaseDetails?.walrusBlobId) {
      setIsPreviewMode(true);
      setIsReading(true);
      return;
    }

    const url = await ensureBookFileUrl(purchaseDetails.walrusBlobId);
    if (!url) {
      showToast(t("book.toast.downloadFailed"));
      return;
    }

    setIsPreviewMode(false);
    setIsReading(true);
  }, [book, ensureBookFileUrl, isPurchased, purchaseDetails, showToast, t]);

  const handleCloseReader = useCallback(() => {
    setIsPreviewMode(false);
    setIsReading(false);
  }, []);

  const handleReviewCreated = useCallback(() => {
    setBook((prev) => (prev ? { ...prev, reviewsCount: prev.reviewsCount + 1 } : prev));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!purchaseDetails?.walrusBlobId) {
      return;
    }

    const url = await ensureBookFileUrl(purchaseDetails.walrusBlobId);
    if (!url) {
      showToast(t("book.toast.downloadFailed"));
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noreferrer";
    anchor.download = book?.fileName ?? `${book?.title ?? "book"}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [book, ensureBookFileUrl, purchaseDetails, showToast, t]);

  const handleStartPurchase = useCallback(
    async (action: "buy" | "subscribe") => {
      if (!book || isActionLoading) {
        return;
      }

      setActiveAction(action);
      setIsActionLoading(true);

      try {
        const invoiceResponse = await paymentsApi.createInvoice({ bookId: book.id });
        setInvoice(invoiceResponse);
        invoiceStatusRef.current = null;
        setPurchaseModalOpen(true);
      } catch (err) {
        console.error(err);
        setActiveAction(null);
        showToast(t("book.toast.invoiceFailed"));
      } finally {
        setIsActionLoading(false);
      }
    },
    [book, isActionLoading, showToast, t],
  );

  const handleConfirmPurchase = useCallback(async () => {
    if (!book || !invoice || isConfirmingPurchase) {
      return;
    }

    setIsConfirmingPurchase(true);

    try {
      if (!telegramUserId) {
        throw new Error("Missing telegram user id");
      }

      const { purchase } = await purchasesApi.confirm({
        bookId: book.id,
        paymentId: invoice.paymentId,
        telegramUserId,
      });

      const { bookId: _bookId, ...details } = purchase;
      setPurchaseDetails(details);
      setIsPurchased(true);
      setPurchaseModalOpen(false);
      setActiveAction(null);
      setInvoice(null);
      setIsPreviewMode(false);
      setIsReading(false);
      invoiceStatusRef.current = 'paid';
      showToast(t("book.toast.accessGranted"));
      try {
        const updatedBook = await catalogApi.getBook(book.id, { telegramUserId });
        setBook(updatedBook);
      } catch (updateError) {
        console.error(updateError);
      }
    } catch (err) {
      console.error(err);
      showToast(t("book.toast.confirmFailed"));
    } finally {
      setIsConfirmingPurchase(false);
      setIsActionLoading(false);
    }
  }, [book, invoice, isConfirmingPurchase, showToast, t, telegramUserId]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setPurchaseModalOpen(open);

      if (!open && !isPurchased) {
        setActiveAction(null);
        setInvoice(null);
      }
      if (!open) {
        invoiceStatusRef.current = null;
      }
    },
    [isPurchased],
  );

  const handleOpenInvoice = useCallback(() => {
    if (!invoice) {
      return;
    }

    const webApp = (window as any)?.Telegram?.WebApp;
    if (webApp?.openInvoice) {
      webApp.openInvoice(invoice.invoiceLink);
      return;
    }
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(invoice.invoiceLink);
      return;
    }

    window.open(invoice.invoiceLink, "_blank", "noopener,noreferrer");
  }, [invoice]);

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
    setPurchaseDetails(null);
    setActiveAction(null);
    setPurchaseModalOpen(false);
    setIsActionLoading(false);
    setInvoice(null);
    setIsConfirmingPurchase(false);
    setIsPreviewMode(false);
    setIsReading(false);
    invoiceStatusRef.current = null;
    autoReadTriggeredRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!isPurchased && isReading && !isPreviewMode) {
      setIsReading(false);
    }
  }, [isPurchased, isPreviewMode, isReading]);

  useEffect(() => {
    if (!invoice) {
      return;
    }

    const webApp = (window as any)?.Telegram?.WebApp;
    const onEvent = webApp?.onEvent?.bind(webApp);
    if (!onEvent) {
      return;
    }

    const handler = (event: { status?: string } | undefined) => {
      if (!event?.status) {
        return;
      }

      if (event.status === 'paid') {
        if (invoiceStatusRef.current === 'paid') {
          return;
        }
        invoiceStatusRef.current = 'paid';
        void handleConfirmPurchase();
        return;
      }

      if (event.status === 'cancelled') {
        if (invoiceStatusRef.current === 'cancelled') {
          return;
        }
        invoiceStatusRef.current = 'cancelled';
        showToast(t('book.toast.paymentCancelled'));
        return;
      }

      if (event.status === 'failed') {
        if (invoiceStatusRef.current === 'failed') {
          return;
        }
        invoiceStatusRef.current = 'failed';
        showToast(t('book.toast.paymentFailed'));
      }
    };

    onEvent('invoiceClosed', handler);

    return () => {
      webApp?.offEvent?.('invoiceClosed', handler);
    };
  }, [handleConfirmPurchase, invoice, showToast, t]);

  useEffect(() => {
    void loadBook();
  }, [loadBook]);

  useEffect(() => {
    void refreshPurchaseStatus();
  }, [refreshPurchaseStatus]);

  useEffect(() => {
    if (autoReadTriggeredRef.current) {
      return;
    }

    if (searchParams.get("action") !== "read") {
      return;
    }

    if (!book) {
      return;
    }

    autoReadTriggeredRef.current = true;
    void handleRead();
  }, [book, handleRead, searchParams]);

  useEffect(() => {
    const blobId = purchaseDetails?.walrusBlobId ?? null;
    if (!blobId) {
      currentBookBlobIdRef.current = null;
      if (bookFileUrlRef.current) {
        URL.revokeObjectURL(bookFileUrlRef.current);
        bookFileUrlRef.current = null;
      }
      setBookFileUrl(null);
      return;
    }

    void ensureBookFileUrl(blobId);
  }, [ensureBookFileUrl, purchaseDetails?.walrusBlobId]);

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

  const coverSrc = useMemo(() => {
    if (!book) {
      return walrusCover ?? undefined;
    }

    if (book.coverImageData) {
      const mimeType = book.coverMimeType ?? "image/jpeg";
      return `data:${mimeType};base64,${book.coverImageData}`;
    }

    return walrusCover ?? resolveBookCover(book);
  }, [book, walrusCover]);

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
                      src={coverSrc}
                      alt={t("book.coverAlt", { title: book.title })}
                      onError={handleBookCoverError}
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
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Button size="l" onClick={() => void handleRead()}>
                      {t("book.actions.read")}
                    </Button>
                    <Button size="l" mode="outline" onClick={() => void handleDownload()}>
                      {t("book.actions.download")}
                    </Button>
                  </div>
                  {purchaseDetails && (
                    <Card style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                      <Title level="3" weight="2">
                        {t("book.purchase.statusTitle")}
                      </Title>
                      <div style={{ color: "var(--app-subtitle-color)" }}>
                        {t("book.purchase.downloadDescription")}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.blobLabel")}</div>
                          <code style={{ wordBreak: "break-all" }}>{purchaseDetails.walrusBlobId}</code>
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.invoiceIdLabel")}</div>
                          <code style={{ wordBreak: "break-all" }}>{purchaseDetails.paymentId}</code>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.purchasedAtLabel")}</div>
                          <span>{new Date(purchaseDetails.purchasedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Button
                    size="l"
                    loading={isActionLoading && activeAction === "buy"}
                    disabled={isActionLoading}
                    onClick={() => handleStartPurchase("buy")}
                  >
                    {t("book.actions.buy")}
                  </Button>
                  <Button
                    size="l"
                    mode="outline"
                    loading={isActionLoading && activeAction === "subscribe"}
                    disabled={isActionLoading}
                    onClick={() => handleStartPurchase("subscribe")}
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
            <Card style={{ padding: 12, borderRadius: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{book.title}</span>
                <span style={{ fontWeight: 600 }}>
                  {(invoice?.amountStars ?? book.priceStars)} ⭐
                </span>
              </div>
              {invoice && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontWeight: 600 }}>{t("book.purchase.invoiceIdLabel")}</span>
                  <code style={{ wordBreak: "break-all" }}>{invoice.paymentId}</code>
                </div>
              )}
            </Card>
          )}
          {invoice && (
            <>
              <p style={{ margin: 0, lineHeight: 1.5 }}>{t("book.purchase.invoiceDescription")}</p>
              <Button mode="outline" onClick={handleOpenInvoice}>
                {t("book.purchase.openInvoice")}
              </Button>
              <p style={{ margin: 0, lineHeight: 1.5, color: "var(--app-subtitle-color)" }}>
                {t("book.purchase.confirmHelp")}
              </p>
            </>
          )}
          <Button
            size="l"
            mode="filled"
            onClick={handleConfirmPurchase}
            loading={isConfirmingPurchase}
            disabled={!invoice || isConfirmingPurchase}
          >
            {t("book.actions.confirm")}
          </Button>
        </div>
      </Modal>
      {book && isReading && (
        <ReadingOverlay
          book={{ ...book, bookFileURL: bookFileUrl ?? undefined }}
          onClose={handleCloseReader}
          preview={isPreviewMode}
        />
      )}
    </>
  );
}
