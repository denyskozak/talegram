import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { SegmentedControl, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@/app/providers/ThemeProvider";
import { useTMA } from "@/app/providers/TMAProvider";
import { useToast } from "@/shared/ui/ToastProvider";
import { fetchProposalsForVoting, submitBookProposal } from "@/entities/proposal/api";
import type { ProposalForVoting } from "@/entities/proposal/types";
import { fetchAuthors } from "@/entities/author/api";

import {
  BOOK_SECTION,
  HARDCODED_ALLOWED_VOTER_USERNAMES,
  PUBLISH_SECTION,
  REQUIRED_APPROVALS,
  VOTE_SECTION,
} from "./constants";
import { MyBooksSection } from "./components/MyBooksSection";
import { PublishResultModal } from "./components/PublishResultModal";
import { PublishSection } from "./components/PublishSection";
import { VotingSection } from "./components/VotingSection";
import { usePublishForm } from "./hooks/usePublishForm";
import type {
  AccountSection,
  MyBook,
  MyBooksFilter,
  PublishResultState,
  VotingProposal,
} from "./types";
import {
  getAllowedTelegramVoterUsernames,
  getTelegramUserId,
  normalizeTelegramUsername,
} from "@/shared/lib/telegram";
import { isGlobalCategory } from "@/shared/lib/globalCategories";
import { purchasesApi } from "@/entities/purchase/api";
import { catalogApi } from "@/entities/book/api";
import { downloadFile } from "@telegram-apps/sdk-react";
import { buildBookFileDownloadUrl } from "@/shared/api/storage";
import {
  isBookLiked,
  loadLikedBookIds,
  persistLikedBookIds,
  toggleLikedBookId,
} from "@/shared/lib/likedBooks";

export default function MyAccount(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { launchParams } = useTMA();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AccountSection>(BOOK_SECTION);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResultState | null>(null);
  const {
    formState,
    fileInputRef,
    coverInputRef,
    audiobookInputRef,
    handleInputChange,
    handleFileSelect,
    handleCoverSelect,
    handleAudiobookSelect,
    handleHashtagAdd,
    handleHashtagRemove,
    handleHashtagKeyDown,
    collectSubmissionHashtags,
    resetForm,
  } = usePublishForm({ showToast, t });
  const allowedVoterUsernames = useMemo(
    () => getAllowedTelegramVoterUsernames(HARDCODED_ALLOWED_VOTER_USERNAMES),
    [],
  );
  const telegramUsername = useMemo(() => {
    const rawUsername = launchParams?.tgWebAppData?.user?.username ?? null;

    return normalizeTelegramUsername(rawUsername);
  }, [launchParams]);
  const telegramUserId = useMemo(() => {
    const rawId = launchParams?.tgWebAppData?.user?.id;
    return getTelegramUserId(rawId);
  }, [launchParams]);
  const isAllowedVoter = telegramUsername ? allowedVoterUsernames.has(telegramUsername) : false;
  const canVote = Boolean(telegramUsername && isAllowedVoter);
  const [votingProposals, setVotingProposals] = useState<VotingProposal[]>([]);
  const [allowedVotersCount, setAllowedVotersCount] = useState<number>(
    () => allowedVoterUsernames.size,
  );
  const [isVotingLoading, setIsVotingLoading] = useState(false);
  const [votingError, setVotingError] = useState<string | null>(null);
  const [myBooks, setMyBooks] = useState<MyBook[]>([]);
  const [isMyBooksLoading, setIsMyBooksLoading] = useState(false);
  const [myBooksError, setMyBooksError] = useState<string | null>(null);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const likedBookIdsRef = useRef<Set<string>>(new Set());
  const [myBooksFilter, setMyBooksFilter] = useState<MyBooksFilter>("purchased");
  const [authorUsernames, setAuthorUsernames] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [isAuthorsLoading, setIsAuthorsLoading] = useState(true);
  const isAllowedAuthor = telegramUsername ? authorUsernames.has(telegramUsername) : false;
  const canPublish = Boolean(telegramUsername && isAllowedAuthor);
  useEffect(() => {
    let isMounted = true;

    const loadAuthors = async () => {
      setIsAuthorsLoading(true);
      try {
        const authors = await fetchAuthors();
        if (!isMounted) {
          return;
        }
        const normalized = new Set<string>();
        authors.forEach((author) => {
          const normalizedUsername = normalizeTelegramUsername(author.telegramUsername);
          if (normalizedUsername) {
            normalized.add(normalizedUsername);
          }
        });
        

        setAuthorUsernames(normalized);
      } catch (error) {
        console.error("Failed to load allowed authors", error);
        if (!isMounted) {
          return;
        }
        setAuthorUsernames(new Set<string>());
      } finally {
        if (isMounted) {
          setIsAuthorsLoading(false);
        }
      }
    };

    void loadAuthors();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setMyBooksFilter("purchased");

    const likedSet = loadLikedBookIds(telegramUserId);
    likedBookIdsRef.current = likedSet;
    setMyBooks((books) =>
      books.map((item) => ({
        ...item,
        liked: isBookLiked(item.book.id, likedSet),
      })),
    );
  }, [telegramUserId]);

  const enhanceProposalsWithCovers = useCallback(
    async (proposals: ProposalForVoting[]): Promise<VotingProposal[]> => {
      if (proposals.length === 0) {
        return proposals;
      }

      const enhanced = proposals.map((proposal) => {
        const coverData = proposal.coverImageData;
        if (!coverData) {
          return { ...proposal, coverPreviewUrl: null };
        }

        try {
          const mimeType = proposal.coverMimeType ?? "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${coverData}`;
          return { ...proposal, coverPreviewUrl: dataUrl };
        } catch (error) {
          console.error("Failed to decode cover image for proposal", proposal.id, error);
          return { ...proposal, coverPreviewUrl: null };
        }
      });

      return enhanced;
    },
    [],
  );

  const loadMyBooks = useCallback(async () => {
    setIsMyBooksLoading(true);
    setMyBooksError(null);

    if (!telegramUserId) {
      setMyBooks([]);
      setIsMyBooksLoading(false);
      return;
    }

    try {
      const response = await purchasesApi.list({ telegramUserId });
      const likedSet = likedBookIdsRef.current;
      const items = await Promise.all(
        response.items.map(async (item) => {
          try {
            const book = await catalogApi.getBook(item.bookId, { telegramUserId });
            if (!book) {
              return null;
            }

            return {
              book,
              purchase: {
                paymentId: item.paymentId,
                purchasedAt: item.purchasedAt,
                walrusBlobId: item.walrusBlobId,
                walrusFileId: item.walrusFileId,
              },
              liked: isBookLiked(book.id, likedSet),
            } satisfies MyBook;
          } catch (error) {
            console.error("Failed to load book details", error);
            return null;
          }
        }),
      );

      const normalized = items.filter((item): item is MyBook => item !== null);
      setMyBooks(normalized);
    } catch (error) {
      console.error("Failed to load purchased books", error);
      setMyBooksError(t("account.myBooks.loadError"));
    } finally {
      setIsMyBooksLoading(false);
    }
  }, [telegramUserId, t]);

  const handleRetryMyBooks = useCallback(() => {
    void loadMyBooks();
  }, [loadMyBooks]);

  const handleReadBook = useCallback(
    (bookId: string) => {
      const item = myBooks.find((entry) => entry.book.id === bookId);
      if (!item) {
        return;
      }

      const hasStorage = Boolean(
        (typeof item.book.walrusFileId === "string" && item.book.walrusFileId.length > 0) ||
          (typeof item.book.walrusBlobId === "string" && item.book.walrusBlobId.length > 0),
      );

      if (!hasStorage) {
        showToast(t("account.myBooks.toast.missingFile"));
        return;
      }

      navigate(`/reader/${encodeURIComponent(item.book.id)}`);
    },
    [myBooks, navigate, showToast, t],
  );

  const handleDownloadBook = useCallback(
    async (bookId: string) => {
      const item = myBooks.find((entry) => entry.book.id === bookId);
      if (!item) {
        return;
      }

      const hasStorage = Boolean(
        (typeof item.book.walrusFileId === "string" && item.book.walrusFileId.length > 0) ||
          (typeof item.book.walrusBlobId === "string" && item.book.walrusBlobId.length > 0),
      );

      if (!hasStorage) {
        showToast(t("account.myBooks.toast.missingFile"));
        return;
      }

      setDownloadingBookId(bookId);
      try {
        const fileName = item.book.fileName ?? `${item.book.title}.pdf`;
        const downloadUrl = buildBookFileDownloadUrl(bookId, "book", { telegramUserId });
        if (downloadFile.isAvailable()) {
          await downloadFile(downloadUrl, fileName);
        } else {
          showToast(t("account.myBooks.toast.downloadError"));
          return;
        }
      } catch (error) {
        console.error("Failed to download book", error);
        showToast(t("account.myBooks.toast.downloadError"));
      } finally {
        setDownloadingBookId(null);
      }
    },
    [myBooks, showToast, t, telegramUserId],
  );

  const handleToggleLike = useCallback(
    (bookId: string) => {
      setMyBooks((books) => {
        const { updated } = toggleLikedBookId(bookId, likedBookIdsRef.current);
        likedBookIdsRef.current = updated;
        persistLikedBookIds(updated, telegramUserId);

        return books.map((entry) => ({
          ...entry,
          liked: isBookLiked(entry.book.id, updated),
        }));
      });
    },
    [telegramUserId],
  );

  const loadVotingProposals = useCallback(async () => {
    setIsVotingLoading(true);
    setVotingError(null);
    try {
      const response = await fetchProposalsForVoting(telegramUsername ?? undefined);
      const proposalsWithCovers = await enhanceProposalsWithCovers(response.proposals);
      setVotingProposals(proposalsWithCovers);
      setAllowedVotersCount(
        typeof response.allowedVotersCount === "number"
          ? response.allowedVotersCount
          : allowedVoterUsernames.size,
      );
    } catch (error) {
      console.error("Failed to load proposals for voting", error);
      setVotingError(t("account.voting.loadError"));
    } finally {
      setIsVotingLoading(false);
    }
  }, [allowedVoterUsernames, enhanceProposalsWithCovers, t, telegramUsername]);

  useEffect(() => {
    setAllowedVotersCount(allowedVoterUsernames.size);
  }, [allowedVoterUsernames]);

  useEffect(() => {
    if (activeSection === VOTE_SECTION) {
      void loadVotingProposals();
    }
  }, [activeSection, loadVotingProposals]);

  useEffect(() => {
    if (activeSection === BOOK_SECTION) {
      void loadMyBooks();
    }
  }, [activeSection, loadMyBooks]);

  const menuItems = useMemo(
    () => [
      { key: BOOK_SECTION, label: t("account.menu.myBooks") },
      { key: PUBLISH_SECTION, label: t("account.menu.publish") },
      { key: VOTE_SECTION, label: t("account.menu.voting") },
    ],
    [t],
  );

  const handleRetryVoting = useCallback(() => {
    void loadVotingProposals();
  }, [loadVotingProposals]);

  const handlePublishModalClose = useCallback(() => {
    setPublishResult(null);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (!canPublish) {
      showToast(t("account.publish.toastRestricted"));
      return;
    }

    let normalizedPrice = 0;
    if (!formState.isFree) {
      const trimmedPrice = formState.price.trim();
      if (trimmedPrice.length === 0) {
        showToast(t("account.publish.toastMissingPrice"));
        return;
      }

      const parsedPrice = Number.parseFloat(trimmedPrice);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        showToast(t("account.publish.toastInvalidPrice"));
        return;
      }

      normalizedPrice = Math.round(parsedPrice);
    }

    if (!formState.file) {
      showToast(t("account.publish.toastMissingFile"));
      return;
    }

    if (!formState.coverFile) {
      showToast(t("account.publish.toastMissingCover"));
      return;
    }

    if (!isGlobalCategory(formState.globalCategory)) {
      showToast(t("account.publish.toastMissingGlobalCategory"));
      return;
    }

    if (formState.category.trim().length === 0) {
      showToast(t("account.publish.toastMissingCategory"));
      return;
    }

    const submissionHashtags = collectSubmissionHashtags(formState);

    setIsSubmitting(true);
    try {
      await submitBookProposal({
        title: formState.title,
        author: formState.author,
        description: formState.description,
        globalCategory: formState.globalCategory,
        category: formState.category.trim(),
        price: normalizedPrice,
        hashtags: submissionHashtags,
        file: formState.file,
        coverFile: formState.coverFile,
        audiobookFile: formState.audiobookFile,
      });

      const title = formState.title || t("account.publish.toastFallbackTitle");
      setPublishResult({ status: "success", title });
      resetForm();
    } catch (error) {
      console.error("Failed to submit book proposal", error);
      setPublishResult({ status: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedAllowedVoters =
    allowedVotersCount > 0 ? allowedVotersCount : allowedVoterUsernames.size;

  return (
    <>
      <div
        style={{
          margin: "0 auto",
          maxWidth: 720,
          padding: "24px 16px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Title level="1" weight="2">
          {t("account.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.subtitle")}</Text>
      </header>

      <SegmentedControl>
        {menuItems.map((item) => (
          <SegmentedControl.Item
            key={item.key}
            selected={item.key === activeSection}
            onClick={() => setActiveSection(item.key as AccountSection)}
          >
            {item.label}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>

      {activeSection === BOOK_SECTION && (
        <MyBooksSection
          books={myBooks}
          theme={theme}
          t={t}
          isLoading={isMyBooksLoading}
          error={myBooksError}
          onRetry={handleRetryMyBooks}
          onRead={handleReadBook}
          onDownload={handleDownloadBook}
          downloadingBookId={downloadingBookId}
          filter={myBooksFilter}
          onFilterChange={(value) => setMyBooksFilter(value)}
          onToggleLike={handleToggleLike}
        />
      )}

      {activeSection === PUBLISH_SECTION && (
        <PublishSection
          formState={formState}
          theme={theme}
          t={t}
          isSubmitting={isSubmitting}
          fileInputRef={fileInputRef}
          coverInputRef={coverInputRef}
          audiobookInputRef={audiobookInputRef}
          canSubmit={canPublish}
          isAuthorsLoading={isAuthorsLoading}
          onSubmit={handleSubmit}
          onInputChange={handleInputChange}
          onFileSelect={handleFileSelect}
          onCoverSelect={handleCoverSelect}
          onAudiobookSelect={handleAudiobookSelect}
          onHashtagAdd={handleHashtagAdd}
          onHashtagRemove={handleHashtagRemove}
          onHashtagKeyDown={handleHashtagKeyDown}
        />
      )}

      {activeSection === VOTE_SECTION && (
        <VotingSection
          proposals={votingProposals}
          theme={theme}
          t={t}
          isLoading={isVotingLoading}
          error={votingError}
          canVote={canVote}
          isTelegramUser={Boolean(telegramUsername)}
          allowedVotersCount={displayedAllowedVoters}
          requiredApprovals={REQUIRED_APPROVALS}
          onViewDetails={(proposalId) => navigate(`/proposals/${proposalId}`)}
          onRetry={handleRetryVoting}
        />
      )}

        <PublishResultModal
          result={publishResult}
          onClose={handlePublishModalClose}
          t={t}
          theme={theme}
        />
      </div>

    </>
  );
}
