import { Button, Card, Chip, Text, Title } from "@telegram-apps/telegram-ui";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import { REQUIRED_APPROVALS } from "../constants";
import type { PendingVoteState, VoteDirection, VotingProposal } from "../types";

export type VotingSectionProps = {
  proposals: VotingProposal[];
  theme: ThemeColors;
  t: TFunction<"translation">;
  isLoading: boolean;
  error: string | null;
  canVote: boolean;
  isTelegramUser: boolean;
  pendingVote: PendingVoteState;
  allowedVotersCount: number;
  requiredApprovals?: number;
  downloadingProposalId?: string | null;
  onDownload?: (proposalId: string) => void;
  onVote: (proposalId: string, direction: VoteDirection) => void;
  onViewDetails: (proposalId: string) => void;
  onRetry: () => void;
};

export function VotingSection({
  proposals,
  theme,
  t,
  isLoading,
  error,
  canVote,
  isTelegramUser,
  pendingVote,
  allowedVotersCount,
  requiredApprovals = REQUIRED_APPROVALS,
  downloadingProposalId,
  onDownload,
  onVote,
  onViewDetails,
  onRetry,
}: VotingSectionProps): JSX.Element {
  const thresholdLabel = t("account.voting.threshold", {
    count: allowedVotersCount,
    required: requiredApprovals,
  });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title level="2" weight="2">
          {t("account.voting.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.voting.description")}</Text>
        <Text style={{ color: theme.hint }}>{thresholdLabel}</Text>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error ? (
          <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <Text style={{ color: theme.subtitle }}>{error}</Text>
            <Button type="button" mode="outline" size="s" onClick={onRetry}>
              {t("buttons.retry")}
            </Button>
          </Card>
        ) : isLoading ? (
          <Card style={{ padding: 16 }}>
            <Text style={{ color: theme.subtitle }}>{t("account.voting.loading")}</Text>
          </Card>
        ) : proposals.length === 0 ? (
          <Card style={{ padding: 16 }}>
            <Text style={{ color: theme.subtitle }}>{t("account.voting.empty")}</Text>
          </Card>
        ) : (
          <>
            {!canVote && isTelegramUser && (
              <Text style={{ color: theme.hint }}>{t("account.voting.notAllowed")}</Text>
            )}
            {proposals.map((proposal) => {
              const normalizedTitle = proposal.title.trim();
              const coverInitial =
                normalizedTitle.length > 0 ? normalizedTitle.charAt(0).toUpperCase() : "📘";

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
                      {proposal.coverPreviewUrl ? (
                        <img
                          src={proposal.coverPreviewUrl}
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
                      <Text style={{ color: theme.text, fontWeight: 500 }}>
                        {proposal.currency === "stars"
                          ? t("account.voting.price", { value: proposal.price })
                          : t("account.voting.priceWithCurrency", {
                              value: proposal.price,
                              currency: proposal.currency,
                            })}
                      </Text>
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
                      negative: proposal.votes.negativeVotes,
                      required: requiredApprovals,
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
                      onClick={() => onViewDetails(proposal.id)}
                    >
                      {t("account.voting.actions.viewDetails")}
                    </Button>
                    {onDownload && (
                      <Button
                        type="button"
                        size="s"
                        mode="outline"
                        onClick={() => onDownload(proposal.id)}
                        loading={downloadingProposalId === proposal.id}
                      >
                        {t("account.voting.actions.download")}
                      </Button>
                    )}
                    <Button
                      size="s"
                      mode={proposal.votes.userVote === "positive" && canVote ? "filled" : "outline"}
                      onClick={() => onVote(proposal.id, "positive")}
                      loading={
                        pendingVote?.proposalId === proposal.id && pendingVote.direction === "positive"
                      }
                      disabled={!canVote || pendingVote?.proposalId === proposal.id}
                    >
                      {t("account.voting.actions.approve")}
                    </Button>
                    <Button
                      size="s"
                      mode={proposal.votes.userVote === "negative" && canVote ? "filled" : "outline"}
                      onClick={() => onVote(proposal.id, "negative")}
                      loading={
                        pendingVote?.proposalId === proposal.id && pendingVote.direction === "negative"
                      }
                      disabled={!canVote || pendingVote?.proposalId === proposal.id}
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
  );
}
