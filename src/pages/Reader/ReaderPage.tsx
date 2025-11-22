import {ReactNode, useMemo} from "react";

import {useParams} from "react-router-dom";

import {ReadingOverlay} from "@/entities/book/components/ReadingOverlay";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {useTMA} from "@/app/providers/TMAProvider";
import {getTelegramUserId} from "@/shared/lib/telegram";
import {getStoredBookProgress, setStoredBookProgress} from "@/shared/lib/bookProgress";

type ReaderRouteParams = {
    id?: string;
    type?: 'books' | 'proposals';
};

export default function ReaderPage(): ReactNode | undefined {
    const {id, type} = useParams<ReaderRouteParams>();
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
    const downloadUrl = buildBookFileDownloadUrl(id || '', 'book', type, {telegramUserId: telegramUserId});

    return <ReadingOverlay fileUrl={downloadUrl} initialLocation={initialReaderLocation} onLocationChange={handleReaderLocationChange}/>;
}
