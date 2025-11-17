import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";

import {Button, Card, Chip, Modal, Text, Title} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {catalogApi} from "@/entities/book/api";
import {handleBookCoverError, resolveBookCover} from "@/entities/book/lib";
import type {Book, ID, Review} from "@/entities/book/types";
import {downloadFile} from "@telegram-apps/sdk-react";
import {copyTextToClipboard} from "@telegram-apps/sdk";
import {paymentsApi} from "@/entities/payment/api";
import type {Invoice} from "@/entities/payment/types";
import {purchasesApi} from "@/entities/purchase/api";
import {BookRating} from "@/entities/book/components/BookRating";
import {useTMA} from "@/app/providers/TMAProvider";
import {SimilarCarousel} from "@/widgets/SimilarCarousel/SimilarCarousel";
import {ReviewsList} from "@/widgets/ReviewsList/ReviewsList";
import {useScrollToTop} from "@/shared/hooks/useScrollToTop";
import {ErrorBanner} from "@/shared/ui/ErrorBanner";
import {EmptyState} from "@/shared/ui/EmptyState";
import {useToast} from "@/shared/ui/ToastProvider";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {buildMiniAppDirectLink, getTelegramUserId} from "@/shared/lib/telegram";
import {
    isBookLiked,
    loadLikedBookIds,
    persistLikedBookIds,
    toggleLikedBookId,
} from "@/shared/lib/likedBooks";
import {BookPageSkeleton} from "./BookPageSkeleton";
import {QuoteCarouselNotice} from "@/pages/MyAccount/components/QuoteCarouselNotice.tsx";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";

export default function BookPage(): JSX.Element {
    const {id} = useParams<{ id: ID }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const {showToast} = useToast();
    const {launchParams} = useTMA();
    const theme = useTheme();

    const {t} = useTranslation();
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
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [isConfirmingPurchase, setIsConfirmingPurchase] = useState(false);
    const invoiceStatusRef = useRef<'paid' | 'failed' | 'cancelled' | null>(null);
    const likedBookIdsRef = useRef<Set<string>>(new Set());
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );
    const autoReadTriggeredRef = useRef(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    useScrollToTop([id]);

    const isFreeBook = Boolean(book && book.priceStars === 0);
    const hasFullAccess = isPurchased || isFreeBook;
    const hasAudiobook = Boolean(book?.audiobookWalrusFileId);


    const loadBook = useCallback(async () => {
        if (!id) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const item = await catalogApi.getBook(id, {telegramUserId});
            setBook(item);
            if (item.categories) {
                const similarBooksResponse = await catalogApi.listBooks({
                    categoryId: item.categories,
                    limit: 12,
                });
                setSimilar(similarBooksResponse.items.filter((entry) => entry.id !== item.id).slice(0, 6));
            } else {
                setSimilar([]);
            }
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
            return;
        }

        try {
            const status = await purchasesApi.getStatus({bookId: id, telegramUserId});
            setIsPurchased(status.purchased);
        } catch (err) {
            console.error(err);
        }
    }, [id, telegramUserId]);

    const handleShare = useCallback(async () => {
        if (!book) {
            return;
        }

        try {
            const deepLink =
                buildMiniAppDirectLink({startParam: `book/${book.id}`}) ?? window.location.href;
            await copyTextToClipboard(deepLink);
            showToast(t("book.toast.linkCopied"));
        } catch (err) {
            showToast(t("book.toast.linkFailed"));
            console.error(err);
        }
    }, [book, showToast, t]);

    const handleToggleLike = useCallback(() => {
        if (!book) {
            return;
        }

        const {liked, updated} = toggleLikedBookId(book.id, likedBookIdsRef.current);
        likedBookIdsRef.current = updated;
        setIsLiked(liked);
        persistLikedBookIds(updated, telegramUserId);
    }, [book, telegramUserId]);

    const handleScrollToReviews = useCallback(() => {
        reviewsRef.current?.scrollIntoView({behavior: "smooth"});
    }, []);

    const handlePreview = useCallback(() => {
        showToast(t("book.toast.readAccessRequired"));
    }, [showToast, t]);

    const handleRead = useCallback(() => {
        if (!book) {
            return;
        }

        if (!hasFullAccess) {
            showToast(t("book.toast.readAccessRequired"));
            return;
        }

        const hasStorage = Boolean(
            (typeof book.walrusFileId === "string" && book.walrusFileId.length > 0) ||
            (typeof book.walrusBlobId === "string" && book.walrusBlobId.length > 0),
        );

        if (!hasStorage) {
            showToast(t("book.toast.downloadFailed"));
            return;
        }

        navigate(`/reader/${encodeURIComponent(book.id)}`);
    }, [book, hasFullAccess, navigate, showToast, t]);

    const handleListen = useCallback(() => {
        if (!book) {
            return;
        }

        if (!book.audiobookWalrusFileId) {
            showToast(t("book.audiobook.locked"));
            return;
        }

        if (!hasFullAccess) {
            showToast(t("book.toast.listenAccessRequired"));
            return;
        }

        navigate(`/listen/${encodeURIComponent(book.id)}`);
    }, [book, hasFullAccess, navigate, showToast, t]);

    const handleReviewCreated = useCallback((review: Review) => {
        setBook((prev) => {
            if (!prev) {
                return prev;
            }

            const currentVotes = prev.rating.votes ?? 0;
            const currentAverage = prev.rating.average ?? 0;
            const nextVotes = currentVotes + 1;
            const nextAverage = nextVotes === 0
                ? 0
                : Math.round(((currentAverage * currentVotes + review.rating) / nextVotes) * 10) / 10;

            return {
                ...prev,
                reviewsCount: prev.reviewsCount + 1,
                rating: {
                    average: nextAverage,
                    votes: nextVotes,
                },
            };
        });
    }, []);

    const handleDownload = useCallback(async () => {
        if (!hasFullAccess) {
            showToast(t("book.toast.downloadFailed"));
            return;
        }

        setIsDownloading(true);
        try {
            if (!book || !book.id) {
                showToast(t("book.toast.downloadFailed"));
                return;
            }

            const hasStorage = Boolean(
                (typeof book.walrusFileId === "string" && book.walrusFileId.length > 0) ||
                (typeof book.walrusBlobId === "string" && book.walrusBlobId.length > 0),
            );

            if (!hasStorage) {
                showToast(t("book.toast.downloadFailed"));
                return;
            }

            const fileName = book?.fileName ?? `${book?.title ?? "book"}.pdf`;
            const downloadUrl = buildBookFileDownloadUrl(book.id, "book", {telegramUserId});
            if (downloadFile.isAvailable()) {
                await downloadFile(downloadUrl, fileName);
            } else {
                showToast(t("book.toast.downloadFailed"));
                return;
            }
        } catch (error) {
            console.error("Failed to download book", error);
            showToast(t("book.toast.downloadFailed"));
        } finally {
            setIsDownloading(false);
        }
    }, [book, hasFullAccess, showToast, t, telegramUserId]);

    const handleStartPurchase = useCallback(
        async (action: "buy" | "subscribe") => {
            if (!book || isActionLoading || book.priceStars === 0) {
                return;
            }

            setActiveAction(action);
            setIsActionLoading(true);

            try {
                const invoiceResponse = await paymentsApi.createInvoice({bookId: book.id});
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

            await purchasesApi.confirm({
                bookId: book.id,
                paymentId: invoice.paymentId,
                telegramUserId,
            });

            setIsPurchased(true);
            setPurchaseModalOpen(false);
            setActiveAction(null);
            setInvoice(null);
            invoiceStatusRef.current = 'paid';
            showToast(t("book.toast.accessGranted"));
            try {
                const updatedBook = await catalogApi.getBook(book.id, {telegramUserId});
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
        setActiveAction(null);
        setPurchaseModalOpen(false);
        setIsActionLoading(false);
        setInvoice(null);
        setIsConfirmingPurchase(false);
        invoiceStatusRef.current = null;
        autoReadTriggeredRef.current = false;
    }, [id]);

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
        const likedSet = loadLikedBookIds(telegramUserId);
        likedBookIdsRef.current = likedSet;
        setIsLiked(book ? isBookLiked(book.id, likedSet) : false);
    }, [book?.id, telegramUserId]);

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
        handleRead();
    }, [book, handleRead, searchParams]);

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
        return <ErrorBanner message={error} onRetry={loadBook}/>;
    }

    const coverSrc = useMemo(() => {
        if (book?.coverImageData) {
            const mimeType = book.coverMimeType ?? "image/jpeg";
            return `data:${mimeType};base64,${book.coverImageData}`;
        }

        if (!book) {
            return "";
        }

        return resolveBookCover({id: book.id, coverUrl: book.coverUrl});
    }, [book]);

    if (isLoading || !book) {
        return <BookPageSkeleton/>;
    }
    const actionTitle =
        activeAction === "subscribe" ? t("book.modalTitle.subscribe") : t("book.modalTitle.buy");

    return (
        <>
            <main style={{margin: "0 8px", maxWidth: 720, paddingBottom: 96}}>
                <div style={{padding: 16, display: "flex", flexDirection: "column", gap: 16}}>
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 12,
                            }}
                        >
                            <div style={{flex: 1, minWidth: 0}}>
                                <Title level="1" weight="2">
                                    {book.title}
                                </Title>
                                <div style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>{book.authors.join(", ")}</div>
                            </div>
                            <div style={{display: "flex", gap: 4}}>
                                <Button aria-label={t("book.share")} mode="plain" onClick={handleShare}>
                                    🔗
                                </Button>
                                <Button
                                    aria-label={t(isLiked ? "book.actions.unlike" : "book.actions.like", {title: book.title})}
                                    mode="plain"
                                    onClick={handleToggleLike}
                                    aria-pressed={isLiked}
                                >
                                    <span aria-hidden="true">{isLiked ? "❤️" : "💙"}</span>
                                </Button>
                            </div>
                        </div>
                        <Card style={{borderRadius: 24, margin: "0 auto", overflow: "hidden", width: "80vw"}}>
                            <div style={{position: "relative", aspectRatio: "10 / 12"}}>
                                <img
                                    src={coverSrc}
                                    alt={t("book.coverAlt", {title: book.title})}
                                    onError={handleBookCoverError}
                                    style={{width: "100%", height: "100%", objectFit: "cover"}}
                                />
                            </div>
                        </Card>
                    </div>
                </div>
                <div style={{display: "flex", flexDirection: "column", gap: 16}}>
                    <div style={{display: "flex", flexWrap: "wrap", gap: 8}}>
                        {book.tags.map((tag) => (
                            <Chip key={tag} mode="outline">
                                #{tag}
                            </Chip>
                        ))}
                    </div>
                    <Card
                        onClick={handleScrollToReviews}
                        style={{padding: 16, borderRadius: 20, cursor: "pointer"}}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => event.key === "Enter" && handleScrollToReviews()}
                    >
                        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 12,
                                }}
                            >
                                <div style={{flex: 1, minWidth: 200}}>
                                    <BookRating value={book.rating.average} votes={book.rating.votes}/>
                                </div>
                                <Chip mode="outline" style={{fontWeight: 600}}>
                                    {book.priceStars} ⭐
                                </Chip>
                            </div>
                            <div style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                                {t("book.reviewsCount", {count: book.reviewsCount})}
                            </div>
                        </div>
                    </Card>
                    {hasFullAccess ? (
                        <>
                            <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
                                <Button size="l" onClick={handleRead}>
                                    {t("book.actions.read")}
                                </Button>
                                <Button
                                    size="l"
                                    mode="outline"
                                    onClick={() => void handleDownload()}
                                    loading={isDownloading}
                                    disabled={isDownloading}
                                >
                                    {t("book.actions.download")}
                                </Button>
                                {hasAudiobook ? (
                                    <Button size="l" mode="outline" onClick={handleListen}>
                                        {t("book.actions.listen")}
                                    </Button>
                                ) : null}
                            </div>
                            {isDownloading || isLoading ? <QuoteCarouselNotice theme={theme} t={t}/> : null}
                        </>
                    ) : (
                        <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
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
                    {hasAudiobook ? (
                        <Card style={{padding: 16, borderRadius: 20}}>
                            <Text weight="2" style={{marginBottom: 8}}>
                                {t("book.audiobook.title")}
                            </Text>
                            <Text style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)", marginBottom: 8}}>
                                {hasFullAccess
                                    ? t("book.audiobook.listenPrompt")
                                    : t("book.audiobook.locked")}
                            </Text>
                            <Button size="m" mode="outline" onClick={handleListen}>
                                {t("book.actions.listen")}
                            </Button>
                        </Card>
                    ) : null}
                    <Card style={{padding: 16, borderRadius: 20}}>
                        <Title level="3" weight="2" style={{marginBottom: 12}}>
                            {t("book.description.title")}
                        </Title>
                        <p style={{lineHeight: 1.6}}>
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
                        style={{display: "flex", flexDirection: "column", gap: 16}}
                    >
                        <Title level="2" weight="2">
                            {t("book.reviewsSection")}
                        </Title>
                        <ReviewsList api={catalogApi} bookId={book.id} onReviewCreated={handleReviewCreated}/>
                    </section>
                    <section
                        aria-label={t("book.similarSection")}
                        style={{display: "flex", flexDirection: "column", gap: 12}}
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
                            <SimilarCarousel books={similar} onSelect={(bookId) => navigate(`/book/${bookId}`)}/>
                        )}
                    </section>
                </div>
            </main>
            <Modal open={isPurchaseModalOpen} onOpenChange={handleModalOpenChange}>
                <Modal.Header>{actionTitle}</Modal.Header>
                <div style={{padding: 16, display: "flex", flexDirection: "column", gap: 12}}>
                    <p style={{margin: 0, lineHeight: 1.5}}>
                        {activeAction === "subscribe"
                            ? t("book.subscribeDescription")
                            : t("book.buyDescription")}
                    </p>
                    {book && (
                        <Card style={{padding: 12, borderRadius: 16, display: "flex", flexDirection: "column", gap: 8}}>
                            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
                                <span style={{fontWeight: 600}}>{book.title}</span>
                                <span style={{fontWeight: 600}}>
                  {(invoice?.amountStars ?? book.priceStars)} ⭐
                </span>
                            </div>
                            {invoice && (
                                <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                    <span style={{fontWeight: 600}}>{t("book.purchase.invoiceIdLabel")}</span>
                                    <code style={{wordBreak: "break-all"}}>{invoice.paymentId}</code>
                                </div>
                            )}
                        </Card>
                    )}
                    {invoice && (
                        <>
                            <p style={{margin: 0, lineHeight: 1.5}}>{t("book.purchase.invoiceDescription")}</p>
                            <Button mode="outline" onClick={handleOpenInvoice}>
                                {t("book.purchase.openInvoice")}
                            </Button>
                            <p style={{margin: 0, lineHeight: 1.5, color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
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
        </>
    );
}
