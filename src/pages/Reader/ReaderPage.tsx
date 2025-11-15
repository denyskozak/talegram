import { useMemo} from "react";

import {useParams} from "react-router-dom";

import {ReadingOverlay} from "@/entities/book/components/ReadingOverlay";
import {buildBookFileDownloadUrl} from "@/shared/api/storage";
import {useTMA} from "@/app/providers/TMAProvider";
import {getTelegramUserId} from "@/shared/lib/telegram";

type ReaderRouteParams = {
    bookId?: string;
};


export default function ReaderPage(): JSX.Element {
    const {bookId} = useParams<ReaderRouteParams>();
    const {launchParams} = useTMA();
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );
    const downloadUrl = buildBookFileDownloadUrl(bookId || '', 'book', {telegramUserId: telegramUserId});

    return <ReadingOverlay fileUrl={downloadUrl + '.pub'}/>;
}
