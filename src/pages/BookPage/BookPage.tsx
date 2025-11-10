import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button, Card, Chip, Modal, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { catalogApi } from "@/entities/book/api";
import type { Book, ID } from "@/entities/book/types";
import { paymentsApi } from "@/entities/payment/api";
import type { Invoice } from "@/entities/payment/types";
import { purchasesApi } from "@/entities/purchase/api";
import type { PurchaseDetails } from "@/entities/purchase/types";
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
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetails | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<"buy" | "subscribe" | null>(null);
  const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [tonWalletAddress, setTonWalletAddress] = useState("");
  const [tonWalletError, setTonWalletError] = useState<string | null>(null);
  const [isConfirmingPurchase, setIsConfirmingPurchase] = useState(false);
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

  const refreshPurchaseStatus = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      const status = await purchasesApi.getStatus(id);
      setIsPurchased(status.purchased);
      setPurchaseDetails(status.details);
      if (status.details?.tonWalletAddress) {
        setTonWalletAddress((prev) => (prev.trim().length > 0 ? prev : status.details?.tonWalletAddress ?? ""));
      }
    } catch (err) {
      console.error(err);
    }
  }, [id]);

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

  const handleStartPurchase = useCallback(
    async (action: "buy" | "subscribe") => {
      if (!book || isActionLoading) {
        return;
      }

      setActiveAction(action);
      setIsActionLoading(true);
      setTonWalletError(null);

      try {
        const invoiceResponse = await paymentsApi.createInvoice({ bookId: book.id });
        setInvoice(invoiceResponse);
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
    if (!book || !invoice) {
      return;
    }

    const trimmedWallet = tonWalletAddress.trim();
    if (!trimmedWallet) {
      setTonWalletError(t("book.purchase.walletError"));
      return;
    }

    setTonWalletError(null);
    setIsConfirmingPurchase(true);

    try {
      const { purchase } = await purchasesApi.confirm({
        bookId: book.id,
        paymentId: invoice.paymentId,
        tonWalletAddress: trimmedWallet,
      });

      const { bookId: _bookId, ...details } = purchase;
      setPurchaseDetails(details);
      setTonWalletAddress(details.tonWalletAddress);
      setIsPurchased(true);
      setPurchaseModalOpen(false);
      setActiveAction(null);
      setInvoice(null);
      setIsPreviewMode(false);
      setIsReading(false);
      showToast(t("book.toast.accessGranted"));
    } catch (err) {
      console.error(err);
      showToast(t("book.toast.confirmFailed"));
    } finally {
      setIsConfirmingPurchase(false);
      setIsActionLoading(false);
    }
  }, [book, invoice, showToast, t, tonWalletAddress]);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setPurchaseModalOpen(open);

      if (!open && !isPurchased) {
        setActiveAction(null);
      }
      if (!open) {
        setTonWalletError(null);
        if (!isPurchased) {
          setInvoice(null);
        }
      }
    },
    [isPurchased],
  );

  const handleOpenInvoice = useCallback(() => {
    if (!invoice) {
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
    setTonWalletAddress("");
    setTonWalletError(null);
    setIsConfirmingPurchase(false);
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

  useEffect(() => {
    void refreshPurchaseStatus();
  }, [refreshPurchaseStatus]);

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
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Button size="l" onClick={handleRead}>
                      {t("book.actions.read")}
                    </Button>
                    <Button size="l" mode="outline" onClick={handleDownload}>
                      {t("book.actions.download")}
                    </Button>
                  </div>
                  {purchaseDetails && (
                    <Card style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                      <Title level="3" weight="2">
                        {t("book.purchase.statusTitle")}
                      </Title>
                      <div style={{ color: "var(--app-subtitle-color)" }}>
                        {t("book.purchase.nftDescription", { wallet: purchaseDetails.tonWalletAddress })}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.transactionLabel")}</div>
                          <code style={{ wordBreak: "break-all" }}>{purchaseDetails.tonTransactionId}</code>
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.nftAddressLabel")}</div>
                          <code style={{ wordBreak: "break-all" }}>{purchaseDetails.nftAddress}</code>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.purchasedAtLabel")}</div>
                          <span>{new Date(purchaseDetails.purchasedAt).toLocaleString()}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <div style={{ fontWeight: 600 }}>{t("book.purchase.sentAtLabel")}</div>
                          <span>{new Date(purchaseDetails.nftSentAt).toLocaleString()}</span>
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
                <span style={{ fontWeight: 600 }}>{book.priceStars} ⭐</span>
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
            </>
          )}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>{t("book.purchase.walletLabel")}</span>
            <input
              value={tonWalletAddress}
              onChange={(event) => setTonWalletAddress(event.target.value)}
              placeholder={t("book.purchase.walletPlaceholder")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--app-border-color, rgba(0, 0, 0, 0.1))",
                backgroundColor: "var(--tgui--secondary_bg_color, #f5f5f5)",
                color: "inherit",
                fontSize: 16,
              }}
            />
            <span style={{ color: "var(--app-subtitle-color)", fontSize: 14 }}>
              {t("book.purchase.walletHint")}
            </span>
            {tonWalletError && (
              <span style={{ color: "var(--tg-theme-destructive-text-color, #d84a4a)", fontSize: 14 }}>
                {tonWalletError}
              </span>
            )}
          </label>
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
      {book && isReading && <ReadingOverlay book={book} onClose={handleCloseReader} />}
    </>
  );
}
