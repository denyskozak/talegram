import {ReactNode, useMemo} from "react";

import {useParams} from "react-router-dom";

import {ReadingOverlay} from "@/entities/book/components/ReadingOverlay";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {useTMA} from "@/app/providers/TMAProvider";
import {getTelegramUserId} from "@/shared/lib/telegram";

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
    const initialReaderLocation = useMemo(() => {
        const value = window.localStorage.getItem(`book_location_${id}`);
        return window.localStorage && value
            ? value
            : '0';
    }, []);
    const handleReaderLocationChange = (location: string) => {
        if (window.localStorage) {
            console.log("location: ", location);
            window.localStorage.setItem(`book_location_${id}`, String(location));
        }
    }
    const downloadUrl = buildBookFileDownloadUrl(id || '', 'book', type, {telegramUserId: telegramUserId});

    return <ReadingOverlay fileUrl={downloadUrl} initialLocation={initialReaderLocation} onLocationChange={handleReaderLocationChange}/>;
}
