import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Button, Spinner} from "@telegram-apps/telegram-ui";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";

import {ReadingOverlay} from "@/entities/book/components/ReadingOverlay";
import {buildFileDownloadUrl, fetchDecryptedFile} from "@/shared/api/storage";
import {useTMA} from "@/app/providers/TMAProvider";
import {getTelegramUserId} from "@/shared/lib/telegram";
import {QuoteCarouselNotice} from "@/pages/MyAccount/components/QuoteCarouselNotice.tsx";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";

type ReaderRouteParams = {
    fileId?: string;
};


export default function ReaderPage(): JSX.Element {
    const {fileId} = useParams<ReaderRouteParams>();
    const {launchParams} = useTMA();
    const telegramUserId = useMemo(
        () => getTelegramUserId(launchParams?.tgWebAppData?.user?.id),
        [launchParams],
    );

    const downloadUrl = buildFileDownloadUrl(fileId || '', {telegramUserId: telegramUserId});

    return <ReadingOverlay fileUrl={downloadUrl}/>;
}
