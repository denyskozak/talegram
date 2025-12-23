import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams, useSearchParams} from "react-router-dom";

import {Card, Modal, Text, Title} from "@telegram-apps/telegram-ui";

import {useTMA} from "@/app/providers/TMAProvider";
import {buildBookFileDownloadUrl, buildBookPreviewDownloadUrl} from "@/shared/api/storage";
import {buildMiniAppDirectLink, getTelegramUserId} from "@/shared/lib/telegram";
import {Button} from "@/shared/ui/Button";
import {getStoredBookProgress, setStoredBookProgress} from "@/shared/lib/bookProgress";
import {catalogApi} from "@/entities/book/api";
import type {Book} from "@/entities/book/types";
import {shareURL} from "@tma.js/sdk";
import {fetchProposalById} from "@/entities/proposal/api";
import type {BookProposal} from "@/entities/proposal/types";

const SEEK_OFFSET_SECONDS = 30;

export default function ListenBookPage(): JSX.Element {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {id, type} = useParams<{ id?: string, type?: 'books' | 'proposals' }>();
    const resourceType: "books" | "proposals" = type === "proposals" ? "proposals" : "books";
    const isProposal = resourceType === "proposals";
    const [searchParams] = useSearchParams();
    const {launchParams} = useTMA();
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );
    const [book, setBook] = useState<Book | null>(null);
    const [proposal, setProposal] = useState<BookProposal | null>(null);
    const requestedAudioBookId = searchParams.get("audioBookId");
    const availableAudioBooks = useMemo(() => {
        if (isProposal) {
            const proposalAudioBooks = proposal?.audioBooks?.map((audioBook) => ({
                id: audioBook.id,
                title: audioBook.title,
            })) ?? [];

            if (proposalAudioBooks.length > 0) {
                return proposalAudioBooks;
            }

            if (proposal?.audiobookFilePath) {
                return [{id: proposal.id, title: proposal.audiobookFileName ?? proposal.title}];
            }

            return [];
        }

        const bookAudioBooks = book?.audioBooks?.map((audioBook) => ({
            id: audioBook.id,
            title: audioBook.title,
        })) ?? [];

        if (bookAudioBooks.length > 0) {
            return bookAudioBooks;
        }

        if (book?.audiobookFilePath) {
            return [{id: book.id, title: book.audiobookFileName ?? book.title}];
        }

        return [];
    }, [book, isProposal, proposal]);
    const voicePreferenceKey = useMemo(
        () => (id ? `${resourceType}_${id}` : null),
        [id, resourceType],
    );
    const storedAudioBookId = useMemo(() => {
        if (!voicePreferenceKey) {
            return null;
        }

        const stored = getStoredBookProgress('audio_voice', voicePreferenceKey, '');
        return stored.length > 0 ? stored : null;
    }, [voicePreferenceKey]);
    const availableAudioBookIds = useMemo(
        () => availableAudioBooks.map((audioBook) => audioBook.id),
        [availableAudioBooks],
    );
    const sharedAudioPositionSeconds = useMemo(() => {
        const value = searchParams.get("time");
        const parsed = value ? Number.parseFloat(value) : NaN;

        return Number.isFinite(parsed) ? parsed : undefined;
    }, [searchParams]);

    const defaultAudioBookId = useMemo(() => {
        if (requestedAudioBookId && availableAudioBookIds.includes(requestedAudioBookId)) {
            return requestedAudioBookId;
        }

        if (storedAudioBookId && availableAudioBookIds.includes(storedAudioBookId)) {
            return storedAudioBookId;
        }

        return availableAudioBookIds[0] ?? null;
    }, [availableAudioBookIds, requestedAudioBookId, storedAudioBookId]);
    const [selectedAudioBookId, setSelectedAudioBookId] = useState<string | null>(defaultAudioBookId ?? null);
    const playbackResourceId = selectedAudioBookId ?? defaultAudioBookId ?? null;
    const progressStorageKey = playbackResourceId ?? "";
    const savedAudioPositionSeconds = useMemo(
        () => Number.parseFloat(getStoredBookProgress('audio_position', progressStorageKey, '0')),
        [progressStorageKey],
    );

    const initialAudioPositionSeconds = sharedAudioPositionSeconds ?? savedAudioPositionSeconds;
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [shareFromCurrent, setShareFromCurrent] = useState(true);
    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
    const isPreview = searchParams.get("preview") === "1";
    const previewMessage = isPreview ? t("book.toast.previewAudio") : null;
    const listeningTitle = useMemo(
        () => book?.title ?? proposal?.title ?? t("book.listen.title"),
        [book?.title, proposal?.title, t],
    );
    const listeningAuthor = useMemo(() => {
        if (book?.authors) {
            return book.authors.join(", ");
        }

        return proposal?.author ?? null;
    }, [book?.authors, proposal?.author]);
    const listeningEntityId = useMemo(
        () => book?.id ?? proposal?.id ?? id ?? null,
        [book?.id, proposal?.id, id],
    );

    const audioUrl = useMemo(() => {
        if (!playbackResourceId) {
            return null;
        }

        try {
            return isPreview
                ? buildBookPreviewDownloadUrl(playbackResourceId, "audiobook", resourceType, {telegramUserId})
                : buildBookFileDownloadUrl(playbackResourceId, "audiobook", resourceType, {telegramUserId});
        } catch (error) {
            console.error("Failed to build audiobook download url", error);
            return null;
        }
    }, [isPreview, playbackResourceId, resourceType, telegramUserId]);

    const audioBookOptions = useMemo(
        () => {
            return availableAudioBooks.map((audioBook, index) => ({
                value: audioBook.id,
                label: audioBook.title?.trim() ?? t("book.listen.voiceOption", {index: index + 1}),
            }));
        },
        [availableAudioBooks, t],
    );

    useEffect(() => {
        if (!id) {
            setBook(null);
            setProposal(null);
            return;
        }

        setBook(null);
        setProposal(null);

        if (isProposal) {
            fetchProposalById(id).then(setProposal).catch((error) => {
                console.error("Failed to load proposal for listening", error);
            });
        } else {
            catalogApi.getBook(id).then(setBook).catch((error) => {
                console.error("Failed to load book for listening", error);
            });
        }
    }, [id, isProposal]);

    useEffect(() => {
        setSelectedAudioBookId((current) => {
            const isCurrentValid = Boolean(current) && availableAudioBookIds.includes(current);

            return isCurrentValid ? current : defaultAudioBookId ?? null;
        });
    }, [availableAudioBookIds, defaultAudioBookId]);

    useEffect(() => {
        if (!voicePreferenceKey || !playbackResourceId) {
            return;
        }

        setStoredBookProgress('audio_voice', voicePreferenceKey, playbackResourceId);
    }, [playbackResourceId, voicePreferenceKey]);

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
        if (playbackResourceId) {
            setStoredBookProgress('audio_position', playbackResourceId, position.toString());
        }
    }, [playbackResourceId]);

    const handleAudioEnded = useCallback(() => {
        setCurrentTime(0);
        setIsPlaying(false);
        if (playbackResourceId) {
            setStoredBookProgress('audio_position', playbackResourceId, '0');
        }
    }, [playbackResourceId]);

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
    }, [audioUrl, playbackResourceId, setIsPlaying]);

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
        if (!id || !listeningEntityId) {
            return;
        }

        const audioId = playbackResourceId ?? undefined;
        const parts = [`listen_${listeningEntityId}_${resourceType}`];

        if (audioId) {
            parts.push(`audio_${audioId}`);
        }

        const currentSeconds = Math.floor(audioRef.current?.currentTime ?? currentTime ?? 0);

        if (shareFromCurrent && Number.isFinite(currentSeconds) && currentSeconds > 0) {
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
            shareURL(deepLink ?? "", listeningTitle);
        } catch (error) {
            console.error("Failed to share audiobook", error);
        }
    }, [currentTime, id, isPreview, listeningEntityId, listeningTitle, playbackResourceId, resourceType, shareFromCurrent]);

    const handleAudioBookSelect = useCallback((value: string | null) => {
        setSelectedAudioBookId(value);
        if (voicePreferenceKey) {
            setStoredBookProgress('audio_voice', voicePreferenceKey, value ?? "");
        }
        setIsVoiceModalOpen(false);
    }, [voicePreferenceKey]);

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
                    {listeningTitle}
                </Title>
                {listeningAuthor ? (
                    <Text style={{margin: 0, color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                        {listeningAuthor}
                    </Text>
                ) : null}
                {previewMessage ? (
                    <Text style={{margin: 0, color: "var(--tg-theme-hint-color, #7f7f81)"}}>
                        {previewMessage}
                    </Text>
                ) : null}
                {audioBookOptions.length > 0 ? (
                    <>
                        <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                            <Text style={{margin: 0, fontWeight: 600}}>{t("book.listen.voice")}</Text>
                            <Button
                                mode="outline"
                                size="s"
                                onClick={() => setIsVoiceModalOpen(true)}
                            >
                                {
                                    audioBookOptions.find((option) => option.value === (selectedAudioBookId ?? defaultAudioBookId))
                                        ?.label ?? t("book.listen.voice")
                                }
                            </Button>
                        </div>
                        <Modal
                            header={<Modal.Header>{t("book.listen.voice")}</Modal.Header>}
                            open={isVoiceModalOpen}
                            onOpenChange={setIsVoiceModalOpen}
                        >
                            <div style={{height: "60vh", padding: 16, display: "flex", flexDirection: "column", gap: 12}}>
                                {audioBookOptions.map((option) => (
                                    <Button
                                        key={option.value}
                                        mode={option.value === playbackResourceId ? "filled" : "outline"}
                                        onClick={() => handleAudioBookSelect(option.value)}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                                <Button mode="outline" onClick={() => setIsVoiceModalOpen(false)}>
                                    {t("reading-overlay.closeChapters")}
                                </Button>
                            </div>
                        </Modal>
                    </>
                ) : null}
                {audioUrl ? (
                    <>
                    <audio
                        key={playbackResourceId || id}
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
                                {listeningTitle}
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
                        <label style={{display: "inline-flex", alignItems: "center", gap: 8}}>
                            <input
                                type="checkbox"
                                checked={shareFromCurrent}
                                onChange={(event) => setShareFromCurrent(event.target.checked)}
                            />
                            <Text style={{margin: 0}}>{t("book.listen.shareFromCurrent")}</Text>
                        </label>
                        <Button mode="outline" size="s" onClick={handleShareAudio}>
                            {t("book.share")}
                        </Button>
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
