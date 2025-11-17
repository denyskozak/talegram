import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";

import {Button, Card, Text, Title} from "@telegram-apps/telegram-ui";

import {useTMA} from "@/app/providers/TMAProvider";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {getTelegramUserId} from "@/shared/lib/telegram";

export default function ListenBookPage(): JSX.Element {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const {bookId} = useParams<{ bookId?: string }>();
    const {launchParams} = useTMA();
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );

    const audioUrl = useMemo(() => {
        if (!bookId) {
            return null;
        }

        try {
            return buildBookFileDownloadUrl(bookId, "audiobook", {telegramUserId});
        } catch (error) {
            console.error("Failed to build audiobook download url", error);
            return null;
        }
    }, [bookId, telegramUserId]);

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
                    {t("book.listen.title")}
                </Title>
                {audioUrl ? (
                    <audio controls autoPlay src={audioUrl} style={{width: "100%"}}>
                        {t("book.listen.unsupported")}
                    </audio>
                ) : (
                    <Text style={{color: "var(--tg-theme-subtitle-text-color, #7f7f81)"}}>
                        {t("book.listen.unavailable")}
                    </Text>
                )}
            </Card>
        </div>
    );
}
