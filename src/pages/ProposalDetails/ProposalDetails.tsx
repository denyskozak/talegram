import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";

import {Button, Card, Chip, Text, Title} from "@telegram-apps/telegram-ui";

import {useTheme} from "@/app/providers/ThemeProvider";
import {fetchProposalById} from "@/entities/proposal/api";
import type {BookProposal} from "@/entities/proposal/types";

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
    const [proposal, setProposal] = useState<BookProposal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    console.log("proposal: ", proposal);
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
                {t("proposalDetails.back")}
            </Button>

            {isLoading ? (
                <Card style={{padding: 20}}>
                    <Text style={{color: theme.subtitle}}>{t("proposalDetails.loading")}</Text>
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
                            <img style={{width: 200, height: 100}} src={coverImageURL}/>
                        ) : null}
                        <Text style={{color: theme.subtitle}}>{proposal.author}</Text>
                    </header>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 16}}>
                        <Title level="3" weight="2">
                            {t("proposalDetails.sections.overview")}
                        </Title>
                        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("proposalDetails.category")}</Text>
                                <Chip mode="outline">{proposal.category}</Chip>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("proposalDetails.price")}</Text>
                                <Text style={{color: theme.text}}>
                                    {proposal.currency === "stars"
                                        ? `${proposal.price} ⭐`
                                        : `${proposal.price} ${proposal.currency}`}
                                </Text>
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("proposalDetails.hashtags")}</Text>
                                {proposal.hashtags.length > 0 ? (
                                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                                        {proposal.hashtags.map((tag) => (
                                            <Chip key={tag} mode="elevated">
                                                #{tag}
                                            </Chip>
                                        ))}
                                    </div>
                                ) : (
                                    <Text style={{color: theme.subtitle}}>{t("proposalDetails.noHashtags")}</Text>
                                )}
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("proposalDetails.status.label")}</Text>
                                <Text style={{color: theme.text}}>{statusLabel}</Text>
                            </div>
                            <Text style={{color: theme.subtitle}}>
                                {t("proposalDetails.submitted", {value: formattedCreatedAt})}
                            </Text>
                            <Text style={{color: theme.subtitle}}>
                                {t("proposalDetails.updated", {value: formattedUpdatedAt})}
                            </Text>
                        </div>
                    </Card>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 12}}>
                        <Title level="3" weight="2">
                            {t("proposalDetails.sections.description")}
                        </Title>
                        <Text style={{color: theme.text, whiteSpace: "pre-wrap"}}>
                            {proposal.description}
                        </Text>
                    </Card>

                    <Card style={{padding: 20, display: "flex", flexDirection: "column", gap: 12}}>
                        <Title level="3" weight="2">
                            {t("proposalDetails.sections.files")}
                        </Title>
                        <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("proposalDetails.manuscript")}</Text>
                                <Text style={{color: theme.subtitle}}>{proposal.fileName}</Text>
                                {proposal.walrusBlobUrl ? (
                                    <a
                                        href={proposal.walrusBlobUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            color: theme.accent,
                                            fontWeight: 500,
                                        }}
                                    >
                                        {t("proposalDetails.download")}
                                    </a>
                                ) : (
                                    <Text style={{color: theme.hint}}>{t("proposalDetails.noDownload")}</Text>
                                )}
                            </div>
                            <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                                <Text weight="2">{t("proposalDetails.cover")}</Text>
                                <Text style={{color: theme.subtitle}}>
                                    {proposal.coverFileName ?? t("proposalDetails.noCover")}
                                </Text>
                            </div>
                        </div>
                    </Card>
                </>
            ) : null}
        </div>
    );
}
