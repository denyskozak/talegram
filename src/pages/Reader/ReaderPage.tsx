import {ReactNode, useEffect, useMemo, useState} from "react";

import {useNavigate, useParams, useSearchParams} from "react-router-dom";
import {Text} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";

import {ReadingOverlay} from "@/entities/book/components/ReadingOverlay";
import {buildBookFileDownloadUrl, buildBookPreviewDownloadUrl} from "@/shared/api/storage";
import {useTMA} from "@/app/providers/TMAProvider";
import {getTelegramUserId} from "@/shared/lib/telegram";
import {getStoredBookProgress, setStoredBookProgress} from "@/shared/lib/bookProgress";
import {catalogApi} from "@/entities/book/api.ts";
import {Book} from "@/entities/book/types.ts";
import {useLaunchParams} from "@tma.js/sdk-react";
import {Button} from "@/shared/ui/Button.tsx";
import {backButton} from "@tma.js/sdk";

type ReaderRouteParams = {
    id?: string;
    type?: 'books' | 'proposals';
};

export default function ReaderPage(): ReactNode | undefined {
    const {id, type} = useParams<ReaderRouteParams>();
    const [searchParams] = useSearchParams();
    const {t} = useTranslation();
    const {launchParams} = useTMA();
    const navigate = useNavigate();
    const [book, updateBook] = useState<Book | null>(null);
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );
    const {tgWebAppFullscreen, tgWebAppPlatform} = useLaunchParams();

    useEffect(() => {

        function listener() {
            if (backButton.onClick.isAvailable()) {

                console.log("window.history.length: ", window.history.length);
                if (window.history.length < 2) {
                    navigate(`/book/${book?.id}`);
                    return;
                }
            }
        }

        // or
        backButton.onClick(listener);
        return () => {
            backButton.offClick(listener);
        }
    }, []);

    if (id === undefined || type === undefined) return null;
    
    const isPreview = searchParams.get('preview') === '1';

    const initialReaderLocation = useMemo(
        () =>  isPreview ? '0' : getStoredBookProgress('reader_location', id, '0'),
        [id,],
    );
    const handleReaderLocationChange = (location: string) => {
        setStoredBookProgress('reader_location', id, String(location));
    };
    const previewMessage = isPreview ? t("book.toast.previewChapters") : null;
    const downloadUrl = isPreview
        ? buildBookPreviewDownloadUrl(id || '', 'book', type, {telegramUserId})
        : buildBookFileDownloadUrl(id || '', 'book', type, {telegramUserId: telegramUserId});

    useEffect(() => {
        if (type ==='books') {
            catalogApi
                .getBook(id)
                .then(data => {updateBook(data)})
                .catch(error => console.error(error))
        }
    }, []);
    return (
        <div style={{display: "flex", flexDirection: "column", gap: 12, width: "100vw", overflow: "hidden"}}>
            {previewMessage ? (
                <div style={{marginTop:tgWebAppFullscreen && tgWebAppPlatform !== 'weba' ? "10vh" : 0}}>
                    <Text style={{margin: 0, color: "var(--tg-theme-hint-color, #7f7f81)"}}>
                        {previewMessage} <Button size="s" onClick={() => navigate(`/book/${id}`)}>{t("book.actions.buy")}</Button>
                    </Text>
                </div>
            ) : null}
            <ReadingOverlay
                book={book}
                isPreview={isPreview}
                fileUrl={downloadUrl}
                initialLocation={initialReaderLocation}
                onLocationChange={handleReaderLocationChange}
            />
        </div>
    );
}
