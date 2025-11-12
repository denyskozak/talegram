import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { Button, Card, Chip, Text, Title } from "@telegram-apps/telegram-ui";

import { useTheme } from "@/app/providers/ThemeProvider";
import { fetchProposalById } from "@/entities/proposal/api";
import type { BookProposal } from "@/entities/proposal/types";
import { fetchDecryptedBlob } from "@/shared/api/storage";
import { base64ToUint8Array } from "@/shared/lib/base64";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

type AssetUrls = { cover: string | null; book: string | null };

export default function ProposalDetails(): JSX.Element {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<BookProposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const assetUrlsRef = useRef<AssetUrls>({ cover: null, book: null });
  const [assetUrls, setAssetUrls] = useState<AssetUrls>(assetUrlsRef.current);

  useEffect(
    () => () => {
      const { cover, book } = assetUrlsRef.current;
      if (cover) {
        URL.revokeObjectURL(cover);
      }
      if (book) {
        URL.revokeObjectURL(book);
      }
    },
    [],
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

        let nextCoverUrl: string | null = null;
        let nextBookUrl: string | null = null;

        if (data.coverWalrusBlobId) {
          try {
            const coverBlob = await fetchDecryptedBlob(data.coverWalrusBlobId);
            nextCoverUrl = URL.createObjectURL(
              new Blob([base64ToUint8Array(coverBlob.data)], {
                type: coverBlob.mimeType ?? data.coverMimeType ?? "image/jpeg",
              }),
            );
          } catch (coverError) {
            console.error("Failed to load proposal cover", coverError);
          }
        }

        if (data.walrusBlobId) {
          try {
            const bookBlob = await fetchDecryptedBlob(data.walrusBlobId);
            nextBookUrl = URL.createObjectURL(
              new Blob([base64ToUint8Array(bookBlob.data)], {
                type: bookBlob.mimeType ?? data.mimeType ?? "application/octet-stream",
              }),
            );
          } catch (bookError) {
            console.error("Failed to load proposal manuscript", bookError);
          }
        }

        if (!isCancelled) {
          setAssetUrls((current) => {
            if (current.cover && current.cover !== nextCoverUrl) {
              URL.revokeObjectURL(current.cover);
            }
            if (current.book && current.book !== nextBookUrl) {
              URL.revokeObjectURL(current.book);
            }

            const updated: AssetUrls = {
              cover: nextCoverUrl,
              book: nextBookUrl,
            };
            assetUrlsRef.current = updated;
            return updated;
          });
          setProposal(data);
        } else {
          if (nextCoverUrl) {
            URL.revokeObjectURL(nextCoverUrl);
          }
          if (nextBookUrl) {
            URL.revokeObjectURL(nextBookUrl);
          }
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
  const statusLabel = proposal ? t(`proposalDetails.status.${proposal.status}`) : "";

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
        <Card style={{ padding: 20 }}>
          <Text style={{ color: theme.subtitle }}>{t("proposalDetails.loading")}</Text>
        </Card>
      ) : error ? (
        <Card style={{ padding: 20 }}>
          <Text style={{ color: theme.subtitle }}>{error}</Text>
        </Card>
      ) : proposal ? (
        <>
          <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Title level="1" weight="2">
              {proposal.title}
            </Title>
            {assetUrls.cover ? (
              <img
                style={{ width: 200, height: 100, objectFit: "cover" }}
                src={assetUrls.cover}
                alt={t("account.voting.coverAlt", { title: proposal.title })}
              />
            ) : null}
            <Text style={{ color: theme.subtitle }}>{proposal.author}</Text>
          </header>

          <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <Title level="3" weight="2">
              {t("proposalDetails.sections.overview")}
            </Title>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Text weight="2">{t("proposalDetails.category")}</Text>
                <Chip mode="outline">{proposal.category}</Chip>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Text weight="2">{t("proposalDetails.price")}</Text>
                <Text style={{ color: theme.text }}>
                  {proposal.currency === "stars"
                    ? `${proposal.price} ⭐`
                    : `${proposal.price} ${proposal.currency}`}
                </Text>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Text weight="2">{t("proposalDetails.hashtags")}</Text>
                {proposal.hashtags.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {proposal.hashtags.map((tag) => (
                      <Chip key={tag} mode="elevated">
                        #{tag}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <Text style={{ color: theme.subtitle }}>{t("proposalDetails.noHashtags")}</Text>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Text weight="2">{t("proposalDetails.status.label")}</Text>
                <Text style={{ color: theme.text }}>{statusLabel}</Text>
              </div>
              <Text style={{ color: theme.subtitle }}>
                {t("proposalDetails.submitted", { value: formattedCreatedAt })}
              </Text>
              <Text style={{ color: theme.subtitle }}>
                {t("proposalDetails.updated", { value: formattedUpdatedAt })}
              </Text>
            </div>
          </Card>

          <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <Title level="3" weight="2">
              {t("proposalDetails.sections.description")}
            </Title>
            <Text style={{ color: theme.text, whiteSpace: "pre-wrap" }}>{proposal.description}</Text>
          </Card>

          <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <Title level="3" weight="2">
              {t("proposalDetails.sections.files")}
            </Title>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Text weight="2">{t("proposalDetails.manuscript")}</Text>
                <Text style={{ color: theme.subtitle }}>{proposal.fileName}</Text>
                {assetUrls.book ? (
                  <a
                    href={assetUrls.book}
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
                  <Text style={{ color: theme.hint }}>{t("proposalDetails.noDownload")}</Text>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Text weight="2">{t("proposalDetails.cover")}</Text>
                <Text style={{ color: theme.subtitle }}>
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

