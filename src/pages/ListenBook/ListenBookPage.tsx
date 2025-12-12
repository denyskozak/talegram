import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";

import {Card, Text, Title} from "@telegram-apps/telegram-ui";

import {useTMA} from "@/app/providers/TMAProvider";
import {buildBookFileDownloadUrl, buildBookPreviewDownloadUrl} from "@/shared/api/storage";
import {buildMiniAppDirectLink, getTelegramUserId} from "@/shared/lib/telegram";
import {Button} from "@/shared/ui/Button";
import {getStoredBookProgress, setStoredBookProgress} from "@/shared/lib/bookProgress";
import {catalogApi} from "@/entities/book/api";
import type {Book} from "@/entities/book/types";
import {shareURL} from "@tma.js/sdk";

const SEEK_OFFSET_SECONDS = 30;

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
    const sharedAudioPositionSeconds = useMemo(() => {
        const value = searchParams.get("time");
        const parsed = value ? Number.parseFloat(value) : NaN;

        return Number.isFinite(parsed) ? parsed : undefined;
    }, [searchParams]);

    const savedAudioPositionSeconds = useMemo(
        () => Number.parseFloat(getStoredBookProgress('audio_position', id, '0')),
        [id],
    );

    const initialAudioPositionSeconds = sharedAudioPositionSeconds ?? savedAudioPositionSeconds;
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const isPreview = searchParams.get("preview") === "1";
    const previewMessage = isPreview ? t("book.toast.previewAudio") : null;

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
            if (!Number.isFinite(initialAudioPositionSeconds) || initialAudioPositionSeconds <= 0) {
                return;
            }

            const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : null;
            const target = duration ? Math.min(initialAudioPositionSeconds, duration) : initialAudioPositionSeconds;
            if (target > 0) {
                try {
                    audioElement.currentTime = target;
                    setCurrentTime(Math.floor(target));
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
    }, [audioUrl, initialAudioPositionSeconds]);

    useEffect(() => {
        setAudioDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
    }, [audioUrl]);

    const handleAudioProgressChange = useCallback(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        const position = Math.floor(audioElement.currentTime);
        setCurrentTime(position);
        setStoredBookProgress('audio_position', id, position.toString());
    }, [id]);

    const handleAudioEnded = useCallback(() => {
        setCurrentTime(0);
        setIsPlaying(false);
        setStoredBookProgress('audio_position', id, '0');
    }, [id]);

    const handleAudioLoadedMetadata = useCallback(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
        setAudioDuration(duration);
        setCurrentTime(Math.floor(audioElement.currentTime));
    }, []);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        audioElement.playbackRate = playbackRate;
    }, [playbackRate]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audioElement.addEventListener("play", handlePlay);
        audioElement.addEventListener("playing", handlePlay);
        audioElement.addEventListener("pause", handlePause);
        audioElement.addEventListener("ended", handlePause);

        return () => {
            audioElement.removeEventListener("play", handlePlay);
            audioElement.removeEventListener("playing", handlePlay);
            audioElement.removeEventListener("pause", handlePause);
            audioElement.removeEventListener("ended", handlePause);
        };
    }, []);

    const handlePlaybackRateChange = useCallback((rate: number) => {
        setPlaybackRate(rate);
        if (audioRef.current) {
            audioRef.current.playbackRate = rate;
        }
    }, []);

    const formatTime = useCallback((value: number) => {
        const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
        const minutes = Math.floor(safeValue / 60);
        const seconds = Math.floor(safeValue % 60);

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    const handleSeek = useCallback((offsetSeconds: number) => {
        const audioElement = audioRef.current;
        if (!audioElement) {
            return;
        }

        const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : null;
        const nextTime = duration
            ? Math.min(Math.max(audioElement.currentTime + offsetSeconds, 0), duration)
            : Math.max(audioElement.currentTime + offsetSeconds, 0);

        try {
            audioElement.currentTime = nextTime;
            setCurrentTime(Math.floor(nextTime));
        } catch (error) {
            console.warn("Failed to seek audio", error);
        }
    }, []);

    const handleManualSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const target = Number.parseFloat(event.target.value);
        const audioElement = audioRef.current;

        if (!audioElement || Number.isNaN(target)) {
            return;
        }

        try {
            audioElement.currentTime = target;
            setCurrentTime(target);
        } catch (error) {
            console.warn("Failed to set audio position from range", error);
        }
    }, []);

    const handleTogglePlay = useCallback(() => {
        const audioElement = audioRef.current;

        if (!audioElement) {
            return;
        }

        if (audioElement.paused) {
            void audioElement.play().catch((error) => {
                console.warn("Failed to start playback", error);
            });
        } else {
            audioElement.pause();
        }
    }, []);

    const handleShareAudio = useCallback(() => {
        if (!id || !type || !book) {
            return;
        }

        const parts = [`listen_${id}_${type}`];
        const currentSeconds = Math.floor(audioRef.current?.currentTime ?? currentTime ?? 0);

        if (Number.isFinite(currentSeconds) && currentSeconds > 0) {
            parts.push(`time_${currentSeconds}`);
        }

        if (isPreview) {
            parts.push("preview_1");
        }

        const deepLink = buildMiniAppDirectLink({
            botUsername: "talegram_org_bot",
            startParam: parts.join("_"),
        });

        try {
            shareURL(deepLink ?? "", book.title);
        } catch (error) {
            console.error("Failed to share audiobook", error);
        }
    }, [book, currentTime, id, isPreview, type]);

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
                {previewMessage ? (
                    <Text style={{margin: 0, color: "var(--tg-theme-hint-color, #7f7f81)"}}>
                        {previewMessage}
                    </Text>
                ) : null}
                {audioUrl ? (
                    <>
                    <audio
                        key={id}
                        ref={audioRef}
                        autoPlay
                        preload="metadata"
                        src={audioUrl}
                        style={{display: "none"}}
                        controlsList="nodownload noplaybackrate noremoteplayback"
                        onLoadedMetadata={handleAudioLoadedMetadata}
                        onDurationChange={handleAudioLoadedMetadata}
                        onTimeUpdate={handleAudioProgressChange}
                        onPause={handleAudioProgressChange}
                        onEnded={handleAudioEnded}
                    >
                        {t("book.listen.unsupported")}
                    </audio>
                    <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12}}>
                            <Button mode="filled" size="s" onClick={handleTogglePlay}>
                                {isPlaying ? t("book.listen.pause") : t("book.listen.play")}
                            </Button>
                            <Text style={{margin: 0, color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                                {book?.title ?? t("book.listen.title")}
                            </Text>
                        </div>
                        <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                            <input
                                aria-label={t("book.listen.seek")}
                                type="range"
                                min={0}
                                max={audioDuration || 0}
                                step={1}
                                value={Math.min(currentTime, audioDuration || currentTime)}
                                onChange={handleManualSeek}
                                style={{width: "100%"}}
                            />
                            <div style={{display: "flex", justifyContent: "space-between", color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                                <Text style={{margin: 0}}>{formatTime(currentTime)}</Text>
                                <Text style={{margin: 0}}>{formatTime(audioDuration)}</Text>
                            </div>
                        </div>
                    </div>
                    </>
                ) : (
                    <Text style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                        {t("book.listen.unavailable")}
                    </Text>
                )}
                {audioUrl ? (
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        <Button mode="outline" size="s" onClick={() => handleSeek(-SEEK_OFFSET_SECONDS)}>
                            <span aria-hidden="true" style={{display: "inline-flex", alignItems: "center", gap: 4}}>
                                <span role="img">⏪</span>
                            </span>
                            <span>{t("book.listen.seekBackward", {seconds: SEEK_OFFSET_SECONDS})}</span>
                        </Button>
                        <Button mode="outline" size="s" onClick={() => handleSeek(SEEK_OFFSET_SECONDS)}>
                            <span aria-hidden="true" style={{display: "inline-flex", alignItems: "center", gap: 4}}>
                                <span role="img">⏩</span>
                            </span>
                            <span>{t("book.listen.seekForward", {seconds: SEEK_OFFSET_SECONDS})}</span>
                        </Button>
                    </div>
                ) : null}
                <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
                    <Text style={{margin: 0, fontWeight: 600}}>{t("book.listen.speed")}</Text>
                    {[1, 1.2, 1.3, 1.5].map((rate) => (
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
                {audioUrl ? (
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center"}}>
                        <Button mode="outline" size="s" onClick={handleShareAudio}>
                            {t("book.share")}
                        </Button>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
