import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";

import {Card, Chip, Text, Title} from "@telegram-apps/telegram-ui";

import {useTheme} from "@/app/providers/ThemeProvider";
import {useTMA} from "@/app/providers/TMAProvider";
import {useToast} from "@/shared/ui/ToastProvider";
import {fetchProposalById, submitProposalVote} from "@/entities/proposal/api";
import type {BookProposal} from "@/entities/proposal/types";
import type {VoteDirection} from "@/pages/MyAccount/types";
import {REQUIRED_APPROVALS} from "@/pages/MyAccount/constants";
import {getTelegramUserId} from "@/shared/lib/telegram";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {downloadFile} from "@tma.js/sdk-react";
import {Button} from "@/shared/ui/Button";

function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

export default function ProposalDetails(): JSX.Element {
    const {t} = useTranslation();
    const theme = useTheme();
    const navigate = useNavigate();
    const {id} = useParams<{ id: string }>();
    const {launchParams} = useTMA();
    const {showToast} = useToast();
    const [proposal, setProposal] = useState<BookProposal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingVote, setPendingVote] = useState<VoteDirection | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const telegramUserId = useMemo(() => {
        const user = launchParams?.tgWebAppData?.user;
        const rawId = user?.id;

        return getTelegramUserId(rawId);
    }, [launchParams]);
    const [allowedVotersCount, setAllowedVotersCount] = useState<number>(0);
    const [isCommunityMember, setIsCommunityMember] = useState(false);
    const canVote = useMemo(
        () => Boolean(telegramUserId && isCommunityMember),
        [isCommunityMember, telegramUserId],
    );

    useEffect(() => {
        if (!id) {
            setError(t("proposalDetails.loadError"));
            setIsLoading(false);
            return;
        }

        let isCancelled = false;

        const loadProposal = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await fetchProposalById(id);
                if (!isCancelled) {
                    setProposal(data);
                    setIsCommunityMember(Boolean(data.isCommunityMember));
                    setAllowedVotersCount(
                        typeof data.allowedVotersCount === "number" ? data.allowedVotersCount : 0,
                    );
                }
            } catch (loadError) {
                console.error("Failed to load proposal", loadError);
                if (!isCancelled) {
                    setError(t("proposalDetails.loadError"));
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        void loadProposal();

        return () => {
            isCancelled = true;
        };
    }, [id, t]);

    const formattedCreatedAt = useMemo(
        () => (proposal ? formatDate(proposal.createdAt) : ""),
        [proposal],
    );
    const formattedUpdatedAt = useMemo(
        () => (proposal ? formatDate(proposal.updatedAt) : ""),
        [proposal],
    );
    const statusLabel = proposal
        ? t(`proposalDetails.status.${proposal.status}`)
        : "";
    const coverImageURL = useMemo(() => {
        if (!proposal?.coverImageData) {
            return null;
        }

        try {
            const mimeType = proposal.coverMimeType ?? "image/jpeg";
            return `data:${mimeType};base64,${proposal.coverImageData}`;
        } catch (error) {
            console.error("Failed to build cover image URL", error);
            return null;
        }
    }, [proposal]);

    const thresholdLabel = useMemo(
        () =>
            t("account.voting.threshold", {
                count: allowedVotersCount,
                required: REQUIRED_APPROVALS,
            }),
        [allowedVotersCount, t],
    );

    const votingProgressLabel = useMemo(() => {
        if (!proposal?.votes) {
            return null;
        }

        return t("account.voting.progress", {
            positive: proposal.votes.positiveVotes,
            negative: proposal.votes.negativeVotes,
            required: REQUIRED_APPROVALS,
        });
    }, [proposal, t]);

    const handleDownload = useCallback(async () => {
        if (!proposal?.walrusFileId) {
            showToast(t("account.voting.downloadError"));
            return;
        }

        if (!telegramUserId || !isCommunityMember) {
            showToast(t("account.voting.notAllowed"));
            return;
        }

        setIsDownloading(true);
        try {
            const resolvedFileName = proposal.fileName ?? `${proposal.title}.epub`;
            const downloadUrl = buildBookFileDownloadUrl(
                proposal.id,
                "book",
                "proposals",
                { telegramUserId },
            );

            if (downloadFile.isAvailable()) {
                await downloadFile(downloadUrl, resolvedFileName);
            } else {
                showToast(t("account.voting.downloadError"));
                return;
            }
        } catch (downloadError) {
            console.error("Failed to download proposal manuscript", downloadError);
            showToast(t("account.voting.downloadError"));
        } finally {
            setIsDownloading(false);
        }
    }, [isCommunityMember, proposal, showToast, t, telegramUserId]);

    const handleStartReading = useCallback(() => {
        if (!proposal?.id) {
            return;
        }

        if (!telegramUserId || !isCommunityMember) {
            showToast(t("account.voting.notAllowed"));
            return;
        }

        navigate(`/reader/${encodeURIComponent(proposal.id)}/proposals`);
    }, [isCommunityMember, navigate, proposal, showToast, t, telegramUserId]);

    const handleStartListening = useCallback(() => {
        if (!proposal?.id) {
            return;
        }

        if (!telegramUserId || !isCommunityMember) {
            showToast(t("account.voting.notAllowed"));
            return;
        }

        navigate(`/listen/${encodeURIComponent(proposal.id)}/proposals`);
    }, [isCommunityMember, navigate, proposal, showToast, t, telegramUserId]);

    const handleVote = useCallback(
        async (direction: VoteDirection) => {
            if (!proposal) {
                return;
            }

            if (!telegramUserId || !canVote) {
                showToast(t("account.voting.notAllowed"));
                return;
            }

            setPendingVote(direction);
            try {
                const result = await submitProposalVote({
                    proposalId: proposal.id,
                    isPositive: direction === "positive",
                });

                setAllowedVotersCount(
                    typeof result.allowedVotersCount === "number"
                        ? result.allowedVotersCount
                        : allowedVotersCount,
                );

                setProposal((prev) => {
                    if (!prev) {
                        return prev;
                    }

                    return {
                        ...prev,
                        status: result.status,
                        votes: {
                            positiveVotes: result.positiveVotes,
                            negativeVotes: result.negativeVotes,
                            userVote: result.userVote,
                        },
                    };
                });

                if (result.status === "PENDING") {
                    showToast(t("account.voting.toast.submitted"));
                } else {
                    showToast(
                        result.status === "APPROVED"
                            ? t("account.voting.toast.approved")
                            : t("account.voting.toast.rejected"),
                    );
                }
            } catch (voteError) {
                console.error("Failed to submit vote", voteError);
                showToast(t("account.voting.toast.error"));
            } finally {
                setPendingVote(null);
            }
        },
        [allowedVotersCount, canVote, proposal, showToast, t, telegramUserId],
    );

    return (
        <div
            style={{
                margin: "0 auto",
                maxWidth: 720,
                padding: "24px 16px 32px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
            }}
        >
            <Button type="button" mode="outline" size="s" onClick={() => navigate(-1)}>
                {t("account.proposalDetails.back")}
            </Button>

            {isLoading ? (
                <Card style={{padding: 20}}>
                    <Text style={{color: theme.subtitle}}>{t("account.proposalDetails.loading")}</Text>
                </Card>
            ) : error ? (
                <Card style={{padding: 20}}>
                    <Text style={{color: theme.subtitle}}>{error}</Text>
                </Card>
            ) : proposal ? (
                <>
                    <header style={{display: "flex", flexDirection: "column", gap: 8}}>
                        <Title level="1" weight="2">
                            {proposal.title}
                        </Title>
                        {coverImageURL ? (
                            <Card style={{borderRadius: 24, margin: "0 auto", overflow: "hidden", width: "80vw"}}>
                                <div style={{position: "relative", aspectRatio: "10 / 12"}}>


                                    <img
                                        src={coverImageURL}
                                        alt={t("account.voting.coverAlt", {title: proposal.title})}
                                        style={{width: "100%", height: "100%", objectFit: "cover"}}
                                    />
                                </div>
                            </Card>
                        ) : null}
                        <Text style={{color: theme.subtitle}}>{proposal.author}</Text>
                    </header>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 12}}>
                        <Title level="3" weight="2">
                            {t("account.voting.title")}
                        </Title>
                        <Text style={{color: theme.subtitle}}>{thresholdLabel}</Text>
                        {votingProgressLabel ? (
                            <Text style={{color: theme.subtitle}}>{votingProgressLabel}</Text>
                        ) : null}
                        {proposal.votes?.userVote && canVote ? (
                            <Text style={{color: theme.hint}}>
                                {proposal.votes.userVote === "positive"
                                    ? t("account.voting.youVoted.approve")
                                    : t("account.voting.youVoted.reject")}
                            </Text>
                        ) : null}
                        <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                            <Button
                                size="m"
                                mode="filled"
                                disabled={!canVote || pendingVote !== null}
                                loading={pendingVote === "positive"}
                                onClick={() => handleVote("positive")}
                            >
                                {t("account.voting.actions.approve")}
                            </Button>
                            <Button
                                size="m"
                                mode="filled"
                                disabled={!canVote || pendingVote !== null}
                                loading={pendingVote === "negative"}
                                onClick={() => handleVote("negative")}
                            >
                                {t("account.voting.actions.reject")}
                            </Button>
                        </div>
                        {!canVote && (
                            <Text style={{color: theme.hint}}>{t("account.voting.notAllowed")}</Text>
                        )}
                    </Card>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 16}}>
                        <Title level="3" weight="2">
                            {t("account.proposalDetails.sections.overview")}
                        </Title>
                        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.globalCategory")}</Text>
                                <Chip mode="outline">{proposal.globalCategory}</Chip>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.category")}</Text>
                                <Chip mode="outline">{proposal.category}</Chip>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.price")}</Text>
                                <Text style={{color: theme.text}}>
                                    {proposal.currency === "stars"
                                        ? `${proposal.price} ⭐`
                                        : `${proposal.price} ${proposal.currency}`}
                                </Text>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.hashtags")}</Text>
                                {proposal.hashtags.length > 0 ? (
                                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                                        {proposal.hashtags.map((tag) => (
                                            <Chip key={tag} mode="elevated">
                                                #{tag}
                                            </Chip>
                                        ))}
                                    </div>
                                ) : (
                                    <Text
                                        style={{color: theme.subtitle}}>{t("account.proposalDetails.noHashtags")}</Text>
                                )}
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.status.label")}</Text>
                                <Text style={{color: theme.text}}>{statusLabel}</Text>
                            </div>
                            <Text style={{color: theme.subtitle}}>
                                {t("account.proposalDetails.submitted", {value: formattedCreatedAt})}
                            </Text>
                            <Text style={{color: theme.subtitle}}>
                                {t("account.proposalDetails.updated", {value: formattedUpdatedAt})}
                            </Text>
                        </div>
                    </Card>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 12}}>
                        <Title level="3" weight="2">
                            {t("account.proposalDetails.sections.description")}
                        </Title>
                        <Text style={{color: theme.text, whiteSpace: "pre-wrap"}}>
                            {proposal.description}
                        </Text>
                    </Card>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 12}}>
                        <Title level="3" weight="2">
                            {t("account.proposalDetails.sections.files")}
                        </Title>
                        <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.manuscript")}</Text>
                                <Text style={{color: theme.subtitle}}>{proposal.fileName}</Text>
                                {proposal.walrusFileId ? (
                                    <>
                                        <Button
                                            type="button"
                                            mode="outline"
                                            size="s"
                                            onClick={handleDownload}
                                            loading={isDownloading}
                                            disabled={!isCommunityMember}
                                        >
                                            {t("account.proposalDetails.download")}
                                        </Button>
                                        {!isCommunityMember ? (
                                            <Text style={{color: theme.hint}}>
                                                {t("account.voting.notAllowed")}
                                            </Text>
                                        ) : null}
                                    </>
                                ) : (
                                    <Text style={{color: theme.hint}}>{t("account.proposalDetails.noDownload")}</Text>
                                )}
                                {canVote ? (
                                    <Button
                                        type="button"
                                        mode="filled"
                                        size="s"
                                        onClick={handleStartReading}
                                    >
                                        {t("account.proposalDetails.read")}
                                    </Button>
                                ) : null}
                                {canVote && proposal.audiobookWalrusFileId ? (
                                    <Button
                                        type="button"
                                        mode="outline"
                                        size="s"
                                        onClick={handleStartListening}
                                    >
                                        {t("account.proposalDetails.listen")}
                                    </Button>
                                ) : null}
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.cover")}</Text>
                                <Text style={{color: theme.subtitle}}>
                                    {proposal.coverFileName ?? t("account.proposalDetails.noCover")}
                                </Text>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("account.proposalDetails.audiobook")}</Text>
                                <Text style={{color: theme.subtitle}}>
                                    {proposal.audiobookWalrusFileId
                                        ? t("account.proposalDetails.audiobookAvailable")
                                        : t("account.proposalDetails.noAudiobook")}
                                </Text>
                            </div>
                        </div>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
