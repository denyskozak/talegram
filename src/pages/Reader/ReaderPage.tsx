import {ReactNode, useMemo} from "react";

import {useParams, useSearchParams} from "react-router-dom";
import {Text} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {ReadingOverlay} from "@/entities/book/components/ReadingOverlay";
import {buildBookFileDownloadUrl, buildBookPreviewDownloadUrl} from "@/shared/api/storage";
import {useTMA} from "@/app/providers/TMAProvider";
import {getTelegramUserId} from "@/shared/lib/telegram";
import {getStoredBookProgress, setStoredBookProgress} from "@/shared/lib/bookProgress";

type ReaderRouteParams = {
    id?: string;
    type?: 'books' | 'proposals';
};

export default function ReaderPage(): ReactNode | undefined {
    const {id, type} = useParams<ReaderRouteParams>();
    const [searchParams] = useSearchParams();
    const {t} = useTranslation();
    const {launchParams} = useTMA();
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );
    if (id === undefined || type === undefined) return null;
    const initialReaderLocation = useMemo(
        () => getStoredBookProgress('reader_location', id, '0'),
        [id],
    );
    const handleReaderLocationChange = (location: string) => {
        setStoredBookProgress('reader_location', id, String(location));
    };
    const isPreview = searchParams.get('preview') === '1';
    const previewMessage = isPreview ? t("book.toast.previewChapters") : null;
    const downloadUrl = isPreview
        ? buildBookPreviewDownloadUrl(id || '', 'book', type, {telegramUserId})
        : buildBookFileDownloadUrl(id || '', 'book', type, {telegramUserId: telegramUserId});

    return (
        <div style={{display: "flex", flexDirection: "column", gap: 12, width: "100vw", overflow: "hidden"}}>
            {previewMessage ? (
                <div style={{padding: "12px"}}>
                    <Text style={{margin: 0, color: "var(--tg-theme-hint-color, #7f7f81)"}}>
                        {previewMessage}
                    </Text>
                </div>
            ) : null}
            <ReadingOverlay
                fileUrl={downloadUrl}
                initialLocation={initialReaderLocation}
                onLocationChange={handleReaderLocationChange}
            />
        </div>
    );
}
