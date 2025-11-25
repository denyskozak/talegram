import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";

import {Card, Text, Title} from "@telegram-apps/telegram-ui";

import {useTMA} from "@/app/providers/TMAProvider";
import {buildBookFileDownloadUrl, buildBookPreviewDownloadUrl} from "@/shared/api/storage";
import {getTelegramUserId} from "@/shared/lib/telegram";
import {Button} from "@/shared/ui/Button";
import {getStoredBookProgress, setStoredBookProgress} from "@/shared/lib/bookProgress";
import {catalogApi} from "@/entities/book/api";
import type {Book} from "@/entities/book/types";

export default function ListenBookPage(): JSX.Element {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {id, type} = useParams<{ id?: string, type?: 'books' | 'proposals' }>();
    const [searchParams] = useSearchParams();
    const {launchParams} = useTMA();
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );
    const [book, setBook] = useState<Book | null>(null);
    const savedAudioPositionSeconds = useMemo(
        () => Number.parseFloat(getStoredBookProgress('audio_position', id, '0')),
        [id],
    );
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const isPreview = searchParams.get("preview") === "1";

    const audioUrl = useMemo(() => {
        if (!id) {
            return null;
        }

        try {
            return isPreview
                ? buildBookPreviewDownloadUrl(id, "audiobook", type, {telegramUserId})
                : buildBookFileDownloadUrl(id, "audiobook", type, {telegramUserId});
        } catch (error) {
            console.error("Failed to build audiobook download url", error);
            return null;
        }
    }, [id, isPreview, telegramUserId]);

    useEffect(() => {
        if (!id) {
            return;
        }

        catalogApi.getBook(id).then(setBook).catch((error) => {
            console.error("Failed to load book for listening", error);
        });
    }, [id]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        const setInitialPosition = () => {
            if (!Number.isFinite(savedAudioPositionSeconds) || savedAudioPositionSeconds <= 0) {
                return;
            }

            const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : null;
            const target = duration ? Math.min(savedAudioPositionSeconds, duration) : savedAudioPositionSeconds;
            if (target > 0) {
                try {
                    audioElement.currentTime = target;
                } catch (error) {
                    console.warn("Failed to restore audio position", error);
                }
            }
        };

        if (audioElement.readyState >= 1) {
            setInitialPosition();
        }

        audioElement.addEventListener("loadedmetadata", setInitialPosition);

        return () => {
            audioElement.removeEventListener("loadedmetadata", setInitialPosition);
        };
    }, [audioUrl, savedAudioPositionSeconds]);

    const handleAudioProgressChange = useCallback(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        const position = Math.floor(audioElement.currentTime);
        setStoredBookProgress('audio_position', id, position.toString());
    }, [id]);

    const handleAudioEnded = useCallback(() => {
        setStoredBookProgress('audio_position', id, '0');
    }, [id]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        audioElement.playbackRate = playbackRate;
    }, [playbackRate]);

    const handlePlaybackRateChange = useCallback((rate: number) => {
        setPlaybackRate(rate);
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
        }
    }, []);

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
                {t("book.listen.back")}
            </Button>

            <Card style={{padding: 24, borderRadius: 24, display: "flex", flexDirection: "column", gap: 16}}>
                <Title level="1" weight="2">
                    {book?.title ?? t("book.listen.title")}
                </Title>
                {book ? (
                    <Text style={{margin: 0, color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                        {book.authors.join(", ")}
                    </Text>
                ) : null}
                {audioUrl ? (
                    <audio
                        key={id}
                        ref={audioRef}
                        controls
                        autoPlay
                        src={audioUrl}
                        style={{width: "100%"}}
                        onTimeUpdate={handleAudioProgressChange}
                        onPause={handleAudioProgressChange}
                        onEnded={handleAudioEnded}
                    >
                        {t("book.listen.unsupported")}
                    </audio>
                ) : (
                    <Text style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                        {t("book.listen.unavailable")}
                    </Text>
                )}
                <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
                    <Text style={{margin: 0, fontWeight: 600}}>{t("book.listen.speed")}</Text>
                    {[1, 1.5, 3].map((rate) => (
                        <Button
                            key={rate}
                            mode={playbackRate === rate ? "filled" : "outline"}
                            size="s"
                            onClick={() => handlePlaybackRateChange(rate)}
                        >
                            x{rate}
                        </Button>
                    ))}
                </div>
            </Card>
        </div>
    );
}
