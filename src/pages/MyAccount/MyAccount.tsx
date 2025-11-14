import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useBookReader } from "@/entities/book/hooks/useBookReader";
import { ReadingOverlay } from "@/entities/book/components/ReadingOverlay";

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
  PublishResultState,
  VotingProposal,
} from "./types";
import { getAllowedTelegramVoterUsernames, getTelegramUserId, normalizeTelegramUsername } from "@/shared/lib/telegram";
import { purchasesApi } from "@/entities/purchase/api";
import { catalogApi } from "@/entities/book/api";
import type { MyBook } from "./types";
import { downloadFile } from "@telegram-apps/sdk-react";

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
    handleInputChange,
    handleFileSelect,
    handleCoverSelect,
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
  const [activeBook, setActiveBook] = useState<MyBook | null>(null);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const {
    bookFileUrl,
    ensureBookFileUrl,
    openReader,
    closeReader,
    isReading,
    isPreviewMode,
    resetFile,
  } = useBookReader({ mimeType: activeBook?.book.mimeType });
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
    async (bookId: string) => {
      const item = myBooks.find((entry) => entry.book.id === bookId);
      if (!item) {
        return;
      }

      const fileId =
        item.purchase.walrusFileId ?? item.book.walrusFileId ?? null;

      if (!fileId) {
        showToast(t("account.myBooks.toast.missingFile"));
        return;
      }

      setActiveBook(item);
      const success = await openReader({ fileId, mimeType: item.book.mimeType });
      if (!success) {
        showToast(t("account.myBooks.toast.downloadError"));
        setActiveBook(null);
        resetFile();
      }
    },
    [myBooks, openReader, resetFile, showToast, t],
  );

  const handleDownloadBook = useCallback(
    async (bookId: string) => {
      const item = myBooks.find((entry) => entry.book.id === bookId);
      if (!item) {
        return;
      }

      const fileId =
        item.purchase.walrusFileId ?? item.book.walrusFileId ?? null;

      if (!fileId) {
        showToast(t("account.myBooks.toast.missingFile"));
        return;
      }

      setDownloadingBookId(bookId);
      try {
        const url = await ensureBookFileUrl(fileId, { mimeType: item.book.mimeType });
        if (!url) {
          showToast(t("account.myBooks.toast.downloadError"));
          resetFile();
          return;
        }

        const fileName = item.book.fileName ?? `${item.book.title}.pdf`;
        if (downloadFile.isAvailable()) {
          await downloadFile(url, fileName);
        } else {
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.rel = "noreferrer";
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        }
      } catch (error) {
        console.error("Failed to download book", error);
        showToast(t("account.myBooks.toast.downloadError"));
      } finally {
        setDownloadingBookId(null);
      }
    },
    [ensureBookFileUrl, myBooks, resetFile, showToast, t],
  );

  const handleCloseReaderOverlay = useCallback(() => {
    closeReader();
    resetFile();
    setActiveBook(null);
  }, [closeReader, resetFile]);

  useEffect(() => {
    if (activeSection !== BOOK_SECTION && isReading) {
      handleCloseReaderOverlay();
    }
  }, [activeSection, handleCloseReaderOverlay, isReading]);

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

    if (formState.globalCategory.trim().length === 0) {
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
        globalCategory: formState.globalCategory.trim(),
        category: formState.category.trim(),
        price: normalizedPrice,
        hashtags: submissionHashtags,
        file: formState.file,
        coverFile: formState.coverFile,
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
          canSubmit={canPublish}
          isAuthorsLoading={isAuthorsLoading}
          onSubmit={handleSubmit}
          onInputChange={handleInputChange}
          onFileSelect={handleFileSelect}
          onCoverSelect={handleCoverSelect}
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

      {activeBook && isReading && (
        <ReadingOverlay
          book={{ ...activeBook.book, bookFileURL: bookFileUrl ?? undefined }}
          onClose={handleCloseReaderOverlay}
          preview={isPreviewMode}
        />
      )}
    </>
  );
}
