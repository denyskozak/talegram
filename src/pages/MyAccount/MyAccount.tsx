import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button, Card, Chip, Modal, SegmentedControl, Text, Title } from "@telegram-apps/telegram-ui";
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

const BOOK_SECTION = "myBooks" as const;
const PUBLISH_SECTION = "publish" as const;
const VOTE_SECTION = "voting" as const;

const HARDCODED_ALLOWED_VOTER_IDS = ["1001", "1002", "1003"] as const;

const MAX_HASHTAGS = 8;
const HASHTAG_MAX_LENGTH = 32;

const mockBooks = [
  {
    id: "ton-collectible-01",
    title: "The Blockchain Explorer",
    author: "Eva Anton",
    cover: "/images/books/b1.jpg",
    collection: "Talegram Originals",
    tokenId: "#1245",
    status: "owned" as const,
  },
  {
    id: "ton-collectible-02",
    title: "Waves of the Ton",
    author: "Ilya Mirov",
    cover: "/images/books/b3.jpg",
    collection: "Indie Shelf",
    tokenId: "#0981",
    status: "listed" as const,
  },
  {
    id: "ton-collectible-03",
    title: "Encrypted Tales",
    author: "Sara Kim",
    cover: "/images/books/b7.jpg",
    collection: "Limited Drops",
    tokenId: "#2210",
    status: "owned" as const,
  },
];

type AccountSection = typeof BOOK_SECTION | typeof PUBLISH_SECTION | typeof VOTE_SECTION;

type VoteDirection = "positive" | "negative";

type PublishFormState = {
  title: string;
  author: string;
  description: string;
  category: string;
  hashtags: string[];
  hashtagsInput: string;
  fileName: string;
  file: File | null;
  coverFileName: string;
  coverFile: File | null;
};

type PublishResultState = { status: "success"; title: string } | { status: "error" };

const createInitialFormState = (): PublishFormState => ({
  title: "",
  author: "",
  description: "",
  category: "",
  hashtags: [],
  hashtagsInput: "",
  fileName: "",
  file: null,
  coverFileName: "",
  coverFile: null,
});

export default function MyAccount(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const { launchParams } = useTMA();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<AccountSection>(BOOK_SECTION);
  const [formState, setFormState] = useState<PublishFormState>(() => createInitialFormState());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [publishResult, setPublishResult] = useState<PublishResultState | null>(null);
  const allowedVoterIds = useMemo(() => {
    const hardcoded = new Set<string>(HARDCODED_ALLOWED_VOTER_IDS);
    const raw = import.meta.env.VITE_ALLOWED_TELEGRAM_IDS;
    if (!raw) {
      return hardcoded;
    }

    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .forEach((id) => hardcoded.add(id));

    return hardcoded;
  }, []);
  const fallbackTelegramId = import.meta.env.VITE_MOCK_TELEGRAM_ID;
  const telegramUserId = useMemo(() => {
    const rawUserId = (
      launchParams?.initData as { user?: { id?: number | string } } | undefined
    )?.user?.id;
    if (typeof rawUserId === "number") {
      return rawUserId.toString();
    }
    if (typeof rawUserId === "string" && rawUserId.length > 0) {
      return rawUserId;
    }
    if (typeof fallbackTelegramId === "string" && fallbackTelegramId.length > 0) {
      return fallbackTelegramId;
    }
    return undefined;
  }, [fallbackTelegramId, launchParams]);
  const isAllowedVoter = telegramUserId ? allowedVoterIds.has(telegramUserId) : false;
  const canVote = Boolean(telegramUserId && isAllowedVoter);
  const [votingProposals, setVotingProposals] = useState<ProposalForVoting[]>([]);
  const [allowedVotersCount, setAllowedVotersCount] = useState<number>(() => allowedVoterIds.size);
  const [isVotingLoading, setIsVotingLoading] = useState(false);
  const [votingError, setVotingError] = useState<string | null>(null);
  const [pendingVote, setPendingVote] = useState<{
    proposalId: string;
    direction: VoteDirection;
  } | null>(null);

  const sanitizeHashtag = useCallback((rawValue: string): string | null => {
    if (typeof rawValue !== "string") {
      return null;
    }

    const trimmed = rawValue.replace(/^#+/, "").trim();
    if (trimmed.length === 0) {
      return null;
    }

    return trimmed.slice(0, HASHTAG_MAX_LENGTH);
  }, []);

  const collectSubmissionHashtags = useCallback(
    (state: PublishFormState): string[] => {
      const normalized = new Map<string, string>();

      for (const tag of state.hashtags) {
        const sanitized = sanitizeHashtag(tag);
        if (!sanitized) {
          continue;
        }

        const key = sanitized.toLowerCase();
        if (!normalized.has(key) && normalized.size < MAX_HASHTAGS) {
          normalized.set(key, sanitized);
        }
      }

      if (state.hashtagsInput) {
        const sanitized = sanitizeHashtag(state.hashtagsInput);
        if (sanitized) {
          const key = sanitized.toLowerCase();
          if (!normalized.has(key) && normalized.size < MAX_HASHTAGS) {
            normalized.set(key, sanitized);
          }
        }
      }

      return Array.from(normalized.values());
    },
    [sanitizeHashtag],
  );

  const handleHashtagAdd = useCallback(
    (rawValue: string) => {
      const sanitized = sanitizeHashtag(rawValue);
      if (!sanitized) {
        showToast(t("account.publish.toastHashtagInvalid"));
        return;
      }

      let limitReached = false;
      setFormState((prev) => {
        if (prev.hashtags.length >= MAX_HASHTAGS) {
          limitReached = true;
          return prev.hashtagsInput.length > 0
            ? { ...prev, hashtagsInput: "" }
            : prev;
        }

        const exists = prev.hashtags.some(
          (tag) => tag.toLowerCase() === sanitized.toLowerCase(),
        );
        if (exists) {
          return { ...prev, hashtagsInput: "" };
        }

        return {
          ...prev,
          hashtags: [...prev.hashtags, sanitized],
          hashtagsInput: "",
        };
      });

      if (limitReached) {
        showToast(t("account.publish.toastHashtagLimit", { count: MAX_HASHTAGS }));
      }
    },
    [sanitizeHashtag, showToast, t],
  );

  const handleHashtagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleHashtagAdd(event.currentTarget.value);
    }
  };

  const handleHashtagRemove = useCallback((tagToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((tag) => tag !== tagToRemove),
    }));
  }, []);

  const menuItems = useMemo(
    () => [
      { key: BOOK_SECTION, label: t("account.menu.myBooks") },
      { key: PUBLISH_SECTION, label: t("account.menu.publish") },
      { key: VOTE_SECTION, label: t("account.menu.voting") },
    ],
    [t],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFormState((prev) => ({
      ...prev,
      fileName: file ? file.name : "",
      file: file ?? null,
    }));
  };

  const handleCoverSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFormState((prev) => ({
      ...prev,
      coverFileName: file ? file.name : "",
      coverFile: file ?? null,
    }));
  };

  const loadVotingProposals = useCallback(async () => {
    setIsVotingLoading(true);
    setVotingError(null);
    try {
      const response = await fetchProposalsForVoting(telegramUserId ?? undefined);
      setVotingProposals(response.proposals);
      setAllowedVotersCount(
        typeof response.allowedVotersCount === "number"
          ? response.allowedVotersCount
          : allowedVoterIds.size,
      );
    } catch (error) {
      console.error("Failed to load proposals for voting", error);
      setVotingError(t("account.voting.loadError"));
    } finally {
      setIsVotingLoading(false);
    }
  }, [allowedVoterIds, t, telegramUserId]);

  const handleVote = useCallback(
    async (proposalId: string, direction: VoteDirection) => {
      if (!canVote || !telegramUserId) {
        showToast(
          t(telegramUserId ? "account.voting.notAllowed" : "account.voting.notTelegram"),
        );
        return;
      }

      setPendingVote({ proposalId, direction });
      try {
        const result = await submitProposalVote({
          proposalId,
          telegramUserId,
          isPositive: direction === "positive",
        });

        setAllowedVotersCount(
          typeof result.allowedVotersCount === "number"
            ? result.allowedVotersCount
            : allowedVoterIds.size,
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
    [allowedVoterIds, canVote, showToast, t, telegramUserId],
  );

  useEffect(() => {
    if (activeSection === VOTE_SECTION) {
      void loadVotingProposals();
    }
  }, [activeSection, loadVotingProposals]);

  const handleRetryVoting = useCallback(() => {
    void loadVotingProposals();
  }, [loadVotingProposals]);

  const handlePublishModalClose = useCallback(() => {
    setPublishResult(null);
  }, []);

  const handlePublishModalOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handlePublishModalClose();
      }
    },
    [handlePublishModalClose],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

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
        hashtags: submissionHashtags,
        file: formState.file,
        coverFile: formState.coverFile,
      });

      const title = formState.title || t("account.publish.toastFallbackTitle");
      setPublishResult({ status: "success", title });
      setFormState(createInitialFormState());
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (coverInputRef.current) {
        coverInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to submit book proposal", error);
      setPublishResult({ status: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedAllowedVoters =
    allowedVotersCount > 0 ? allowedVotersCount : allowedVoterIds.size;

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
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Title level="2" weight="2">
              {t("account.myBooks.title")}
            </Title>
            <Text style={{ color: theme.subtitle }}>{t("account.myBooks.description")}</Text>
          </div>
          {mockBooks.map((book) => (
            <Card key={book.id} style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 16 }}>
                <img
                  src={book.cover}
                  alt={t("account.myBooks.coverAlt", { title: book.title })}
                  style={{
                    width: 96,
                    height: 128,
                    borderRadius: 12,
                    objectFit: "cover",
                    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.12)",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div>
                    <Title level="3" weight="2">
                      {book.title}
                    </Title>
                    <Text style={{ color: theme.subtitle }}>{book.author}</Text>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Chip mode="elevated">{t("account.myBooks.tonBadge")}</Chip>
                    <Chip mode="outline">{book.collection}</Chip>
                    <Chip mode="outline">{t(`account.myBooks.status.${book.status}`)}</Chip>
                  </div>
                  <Text style={{ color: theme.hint }}>
                    {t("account.myBooks.token", { token: book.tokenId })}
                  </Text>
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}

      {activeSection === PUBLISH_SECTION && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Title level="2" weight="2">
              {t("account.publish.title")}
            </Title>
            <Text style={{ color: theme.subtitle }}>{t("account.publish.description")}</Text>
          </div>
          <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.name.label")}</Text>
                <input
                  required
                  name="title"
                  value={formState.title}
                  onChange={handleInputChange}
                  placeholder={t("account.publish.form.name.placeholder")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${theme.separator}`,
                    background: theme.section,
                    color: theme.text,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.author.label")}</Text>
                <input
                  required
                  name="author"
                  value={formState.author}
                  onChange={handleInputChange}
                  placeholder={t("account.publish.form.author.placeholder")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${theme.separator}`,
                    background: theme.section,
                    color: theme.text,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.category.label")}</Text>
                <input
                  required
                  name="category"
                  value={formState.category}
                  onChange={handleInputChange}
                  placeholder={t("account.publish.form.category.placeholder")}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${theme.separator}`,
                    background: theme.section,
                    color: theme.text,
                  }}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.hashtags.label")}</Text>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    name="hashtagsInput"
                    value={formState.hashtagsInput}
                    onChange={handleInputChange}
                    onKeyDown={handleHashtagKeyDown}
                    placeholder={t("account.publish.form.hashtags.placeholder")}
                    maxLength={HASHTAG_MAX_LENGTH + 1}
                    autoComplete="off"
                    style={{
                      flex: "1 1 220px",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${theme.separator}`,
                      background: theme.section,
                      color: theme.text,
                      minWidth: 180,
                    }}
                  />
                  <Button
                    type="button"
                    mode="outline"
                    size="s"
                    onClick={() => handleHashtagAdd(formState.hashtagsInput)}
                    disabled={formState.hashtagsInput.trim().length === 0}
                  >
                    {t("account.publish.form.hashtags.add")}
                  </Button>
                </div>
                <Text style={{ color: theme.hint }}>
                  {t("account.publish.form.hashtags.hint", { count: MAX_HASHTAGS })}
                </Text>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {formState.hashtags.length === 0 ? (
                    <Text style={{ color: theme.subtitle }}>
                      {t("account.publish.form.hashtags.empty")}
                    </Text>
                  ) : (
                    formState.hashtags.map((tag) => (
                      <div
                        key={tag}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: `1px solid ${theme.separator}`,
                          background: theme.section,
                        }}
                      >
                        <span style={{ color: theme.text }}>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleHashtagRemove(tag)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: theme.subtitle,
                            cursor: "pointer",
                            padding: 0,
                            lineHeight: 1,
                            fontSize: 14,
                          }}
                          aria-label={t("account.publish.form.hashtags.remove", { tag })}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.description.label")}</Text>
                <textarea
                  required
                  name="description"
                  value={formState.description}
                  onChange={handleInputChange}
                  placeholder={t("account.publish.form.description.placeholder")}
                  rows={5}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${theme.separator}`,
                    background: theme.section,
                    color: theme.text,
                    resize: "vertical",
                    minHeight: 120,
                    font: "inherit",
                  }}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.cover.label")}</Text>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    mode="outline"
                    size="s"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {t("account.publish.form.cover.cta")}
                  </Button>
                  <Text style={{ color: theme.subtitle }}>
                    {formState.coverFileName || t("account.publish.form.cover.placeholder")}
                  </Text>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Text weight="2">{t("account.publish.form.file.label")}</Text>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".epub"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Button type="button" mode="outline" size="s" onClick={() => fileInputRef.current?.click()}>
                    {t("account.publish.form.file.cta")}
                  </Button>
                  <Text style={{ color: theme.subtitle }}>
                    {formState.fileName || t("account.publish.form.file.placeholder")}
                  </Text>
                </div>
              </div>
              <Button
                type="submit"
                mode="filled"
                size="m"
                loading={isSubmitting}
                disabled={!formState.file || !formState.coverFile}
              >
                {t("account.publish.form.submit")}
              </Button>
            </form>
            <Text style={{ color: theme.hint }}>{t("account.publish.form.notice")}</Text>
          </Card>
        </section>
      )}

      {activeSection === VOTE_SECTION && (
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Title level="2" weight="2">
              {t("account.voting.title")}
            </Title>
            <Text style={{ color: theme.subtitle }}>{t("account.voting.description")}</Text>
            <Text style={{ color: theme.hint }}>
              {t("account.voting.threshold", { count: displayedAllowedVoters })}
            </Text>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {!telegramUserId && (
              <Card style={{ padding: 16 }}>
                <Text style={{ color: theme.subtitle }}>{t("account.voting.notTelegram")}</Text>
              </Card>
            )}
            {votingError ? (
              <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <Text style={{ color: theme.subtitle }}>{votingError}</Text>
                <Button type="button" mode="outline" size="s" onClick={handleRetryVoting}>
                  {t("buttons.retry")}
                </Button>
              </Card>
            ) : isVotingLoading ? (
              <Card style={{ padding: 16 }}>
                <Text style={{ color: theme.subtitle }}>{t("account.voting.loading")}</Text>
              </Card>
            ) : votingProposals.length === 0 ? (
              <Card style={{ padding: 16 }}>
                <Text style={{ color: theme.subtitle }}>{t("account.voting.empty")}</Text>
              </Card>
            ) : (
              <>
                {!canVote && telegramUserId && (
                  <Text style={{ color: theme.hint }}>{t("account.voting.notAllowed")}</Text>
                )}
                {votingProposals.map((proposal) => {
                  const normalizedTitle = proposal.title.trim();
                  const coverInitial =
                    normalizedTitle.length > 0
                      ? normalizedTitle.charAt(0).toUpperCase()
                      : "📘";
                  const handleDownload = () => {
                    if (!proposal.walrusBlobUrl) {
                      return;
                    }

                    window.open(proposal.walrusBlobUrl, "_blank", "noopener,noreferrer");
                  };

                  return (
                    <Card
                      key={proposal.id}
                      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
                    >
                      <div style={{ display: "flex", gap: 12 }}>
                        <div
                          style={{
                            width: 72,
                            height: 96,
                            borderRadius: 16,
                            overflow: "hidden",
                            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent}33 100%)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ffffff",
                            fontWeight: 600,
                            fontSize: 24,
                            flexShrink: 0,
                          }}
                        >
                          {proposal.coverImageURL ? (
                            <img
                              src={proposal.coverImageURL}
                              alt={t("account.voting.coverAlt", { title: proposal.title })}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            coverInitial
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                          <Title level="3" weight="2">
                            {proposal.title}
                          </Title>
                          <Text style={{ color: theme.subtitle }}>{proposal.author}</Text>
                          <Text
                            style={{
                              color: theme.text,
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical" as const,
                              overflow: "hidden",
                            }}
                          >
                            {proposal.description}
                          </Text>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                            <Chip mode="outline">{proposal.category}</Chip>
                            {proposal.hashtags.map((tag) => (
                              <Chip key={tag} mode="elevated">
                                #{tag}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Text style={{ color: theme.subtitle }}>
                        {t("account.voting.progress", {
                          positive: proposal.votes.positiveVotes,
                          total: displayedAllowedVoters,
                          negative: proposal.votes.negativeVotes,
                        })}
                      </Text>
                      {proposal.votes.userVote && canVote && (
                        <Text style={{ color: theme.hint }}>
                          {proposal.votes.userVote === "positive"
                            ? t("account.voting.youVoted.approve")
                            : t("account.voting.youVoted.reject")}
                        </Text>
                      )}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Button
                          type="button"
                          size="s"
                          mode="outline"
                          onClick={() => navigate(`/proposals/${proposal.id}`)}
                        >
                          {t("account.voting.actions.viewDetails")}
                        </Button>
                        {proposal.walrusBlobUrl && (
                          <Button
                            type="button"
                            size="s"
                            mode="outline"
                            onClick={handleDownload}
                          >
                            {t("account.voting.actions.download")}
                          </Button>
                        )}
                        <Button
                          size="s"
                          mode={proposal.votes.userVote === "positive" && canVote ? "filled" : "outline"}
                          onClick={() => handleVote(proposal.id, "positive")}
                          loading={
                            pendingVote?.proposalId === proposal.id &&
                            pendingVote.direction === "positive"
                          }
                          disabled={
                            !canVote || pendingVote?.proposalId === proposal.id
                          }
                        >
                          {t("account.voting.actions.approve")}
                        </Button>
                        <Button
                          size="s"
                          mode={proposal.votes.userVote === "negative" && canVote ? "filled" : "outline"}
                          onClick={() => handleVote(proposal.id, "negative")}
                          loading={
                            pendingVote?.proposalId === proposal.id &&
                            pendingVote.direction === "negative"
                          }
                          disabled={
                            !canVote || pendingVote?.proposalId === proposal.id
                          }
                        >
                          {t("account.voting.actions.reject")}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </section>
      )}
      <Modal open={publishResult !== null} onOpenChange={handlePublishModalOpenChange}>
        {publishResult && (
          <>
            <Modal.Header>
              {publishResult.status === "success"
                ? t("account.publish.modal.successTitle")
                : t("account.publish.modal.errorTitle")}
            </Modal.Header>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <Text style={{ color: theme.text }}>
                {publishResult.status === "success"
                  ? t("account.publish.modal.successDescription", { title: publishResult.title })
                  : t("account.publish.modal.errorDescription")}
              </Text>
              <Button mode="filled" size="m" onClick={handlePublishModalClose}>
                {t("account.publish.modal.close")}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
