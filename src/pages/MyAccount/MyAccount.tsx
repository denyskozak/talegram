import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { SegmentedControl, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useTheme } from "@/app/providers/ThemeProvider";
import { useTMA } from "@/app/providers/TMAProvider";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  fetchProposalsForVoting,
  submitBookProposal,
  submitProposalVote,
} from "@/entities/proposal/api";
import type { ProposalForVoting } from "@/entities/proposal/types";
import { fetchAuthors } from "@/entities/author/api";
import { fetchWalrusFiles } from "@/shared/api/storage";
import { base64ToUint8Array } from "@/shared/lib/base64";

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
import { mockBooks } from "./mocks";
import type {
  AccountSection,
  PendingVoteState,
  PublishResultState,
  VoteDirection,
  VotingProposal,
} from "./types";

function normalizeTelegramUsername(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const prefixed = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  return prefixed.toLowerCase();
}

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
  const allowedVoterUsernames = useMemo(() => {
    const allowed = new Set<string>();

    HARDCODED_ALLOWED_VOTER_USERNAMES.forEach((username) => {
      const normalized = normalizeTelegramUsername(username);
      if (normalized) {
        allowed.add(normalized);
      }
    });

    const raw = import.meta.env.VITE_ALLOWED_TELEGRAM_USERNAMES;
    if (typeof raw === "string" && raw.length > 0) {
      raw
        .split(",")
        .map((username) => normalizeTelegramUsername(username))
        .forEach((username) => {
          if (username) {
            allowed.add(username);
          }
        });
    }

    return allowed;
  }, []);
  const fallbackTelegramUsername = import.meta.env.VITE_MOCK_TELEGRAM_USERNAME;
  const telegramUsername = useMemo(() => {
    const rawUsername = (
      launchParams?.initData as { user?: { username?: string | null } } | undefined
    )?.user?.username;

    return (
      normalizeTelegramUsername(rawUsername) ??
      normalizeTelegramUsername(fallbackTelegramUsername)
    );
  }, [fallbackTelegramUsername, launchParams]);
  const isAllowedVoter = telegramUsername ? allowedVoterUsernames.has(telegramUsername) : false;
  const canVote = Boolean(telegramUsername && isAllowedVoter);
  const [votingProposals, setVotingProposals] = useState<VotingProposal[]>([]);
  const [allowedVotersCount, setAllowedVotersCount] = useState<number>(
    () => allowedVoterUsernames.size,
  );
  const [isVotingLoading, setIsVotingLoading] = useState(false);
  const [votingError, setVotingError] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<PendingVoteState>(null);
  const [authorUsernames, setAuthorUsernames] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [isAuthorsLoading, setIsAuthorsLoading] = useState(true);
  const isAllowedAuthor = telegramUsername ? authorUsernames.has(telegramUsername) : false;
  const canPublish = Boolean(telegramUsername && isAllowedAuthor);
  const coverUrlsRef = useRef<string[]>([]);

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

  const revokeCoverUrls = useCallback(() => {
    for (const url of coverUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    coverUrlsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      revokeCoverUrls();
    };
  }, [revokeCoverUrls]);

  const enhanceProposalsWithCovers = useCallback(
    async (proposals: ProposalForVoting[]): Promise<VotingProposal[]> => {
      if (proposals.length === 0) {
        revokeCoverUrls();
        return proposals;
      }

      revokeCoverUrls();

      const coverIds = Array.from(
        new Set(
          proposals
            .map((proposal) => proposal.coverWalrusFileId)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let walrusFilesMap = new Map<string, string>();
      if (coverIds.length > 0) {
        try {
          const walrusFiles = await fetchWalrusFiles(coverIds);
          walrusFilesMap = new Map(walrusFiles.map((file) => [file.fileId, file.data]));
        } catch (error) {
          console.error("Failed to load cover images from Walrus", error);
        }
      }

      const enhanced = proposals.map((proposal) => {
        const coverId = proposal.coverWalrusFileId;
        if (!coverId) {
          return { ...proposal, coverImageURL: null };
        }

        const coverData = walrusFilesMap.get(coverId);
        if (!coverData) {
          return { ...proposal, coverImageURL: null };
        }

        try {
          const blob = new Blob(
            [base64ToUint8Array(coverData)],
            { type: proposal.coverMimeType ?? "image/jpeg" },
          );
          const url = URL.createObjectURL(blob);
          coverUrlsRef.current.push(url);
          return { ...proposal, coverImageURL: url };
        } catch (error) {
          console.error(
            "Failed to decode cover image for proposal",
            proposal.id,
            error,
          );
          return { ...proposal, coverImageURL: null };
        }
      });

      return enhanced;
    },
    [revokeCoverUrls],
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

  const handleVote = useCallback(
    async (proposalId: string, direction: VoteDirection) => {
      if (!telegramUsername || !canVote) {
        showToast(t("account.voting.notAllowed"));
        return;
      }

      setPendingVote({ proposalId, direction });
      try {
        const result = await submitProposalVote({
          proposalId,
          telegramUsername,
          isPositive: direction === "positive",
        });

        setAllowedVotersCount(
          typeof result.allowedVotersCount === "number"
            ? result.allowedVotersCount
            : allowedVoterUsernames.size,
        );

        if (result.status === "PENDING") {
          setVotingProposals((prev) =>
            prev.map((proposal) =>
              proposal.id === proposalId
                ? {
                    ...proposal,
                    votes: {
                      positiveVotes: result.positiveVotes,
                      negativeVotes: result.negativeVotes,
                      userVote: result.userVote,
                    },
                  }
                : proposal,
            ),
          );
          showToast(t("account.voting.toast.submitted"));
        } else {
          setVotingProposals((prev) => prev.filter((proposal) => proposal.id !== proposalId));
          showToast(
            result.status === "APPROVED"
              ? t("account.voting.toast.approved")
              : t("account.voting.toast.rejected"),
          );
        }
      } catch (error) {
        console.error("Failed to submit vote", error);
        showToast(t("account.voting.toast.error"));
      } finally {
        setPendingVote(null);
      }
    },
    [allowedVoterUsernames, canVote, showToast, t, telegramUsername],
  );

  useEffect(() => {
    if (activeSection === VOTE_SECTION) {
      void loadVotingProposals();
    }
  }, [activeSection, loadVotingProposals]);

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

    const normalizedPrice = Math.round(parsedPrice);

    if (!formState.file) {
      showToast(t("account.publish.toastMissingFile"));
      return;
    }

    if (!formState.coverFile) {
      showToast(t("account.publish.toastMissingCover"));
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
        <MyBooksSection books={mockBooks} theme={theme} t={t} />
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
          pendingVote={pendingVote}
          allowedVotersCount={displayedAllowedVoters}
          requiredApprovals={REQUIRED_APPROVALS}
          onVote={handleVote}
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
  );
}
