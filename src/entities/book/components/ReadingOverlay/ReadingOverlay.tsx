import {useCallback, useEffect, useRef, useState} from "react";

import "./ReadingOverlay.css";
import {ReactReader} from "react-reader";

import {type Rendition} from 'epubjs'
import {shareURL} from "@tma.js/sdk";
import {Button} from "@/shared/ui/Button.tsx";
import {useTranslation} from "react-i18next";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";
import {Text} from "@telegram-apps/telegram-ui";
import type {Book} from "@/entities/book/types";
import {buildMiniAppDirectLink} from "@/shared/lib/telegram.ts";
// import {useMediaQuery} from "@uidotdev/usehooks";

type ReadingOverlayProps = {
    book?: Book | null;
    fileUrl: string;
    onLocationChange: (location: string) => void;
    initialLocation: string
    isPreview: boolean
};


export function ReadingOverlay({fileUrl, initialLocation, onLocationChange, isPreview, book}: ReadingOverlayProps): JSX.Element {
    const [location, setLocation] = useState<string>(initialLocation);
    const {t} = useTranslation();
    const themeSetting = useTheme();
    const bookRef = useRef<any | null>(null);
    const renditionRef = useRef<Rendition | undefined>(undefined)
    const [isMenuOpen, setMenuOpen] = useState(false);
    const [textSize, setTextSize] = useState(3);

    const [selection, setSelection] = useState<string | null>(null);
    const hideHeaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const readerIframetRef = useRef<null | HTMLIFrameElement>(null);


    const clearHideHeaderTimeout = () => {
        if (hideHeaderTimeoutRef.current) {
            clearTimeout(hideHeaderTimeoutRef.current);
            hideHeaderTimeoutRef.current = null;
        }
    };


    useEffect(() => {
        const textSizes: Record<number, string> = {
            1: '80%',
            2: '100%',
            3: '140%',
            4: '160%',
            5: '200%',
        }
        renditionRef.current?.themes.fontSize(textSizes[textSize])
    }, [textSize])

    useEffect(() => () => clearHideHeaderTimeout(), [])

    const handleNextTextSize = () => {
        const next = textSize + 1 > 5 ? 1 : textSize + 1;
        setTextSize(next);
    }

    // const handleOpenChapters = () => {
    //     console.log("book: ", renditionRef.current);
    // }
    const handleClearSelection = useCallback(() => {


        setSelection(null);
    }, [selection]);

    const handleShareSelection = useCallback(() => {
        if (!selection || !book) {
            return;
        }

        const excerpt = `\n\n“${selection}”\n\nExcerpt From\n${book.title}\n${book.authors.join(', ')}\nThis material may be protected by copyright`;
        const startParamParts = [`reader_${book.id}_books`];

        if (book.price !== 0) {
            startParamParts.push("preview_1");
        }

        const deepLink = buildMiniAppDirectLink({startParam: startParamParts.join("_"), botUsername: 'talegram_org_bot'}) ;

        try {
            shareURL(deepLink ?? '', excerpt);
        } catch (error) {
            console.error("Failed to share selection", error);
        }
    }, [book, selection]);

    useEffect(() => {
        onLocationChange?.(location)
    }, [location]);

    useEffect(() => {
        const  intervalId = setInterval(() => {
            if (!readerIframetRef.current) return;

            const newSelectedText = (readerIframetRef?.current as unknown as { window: Window})?.window?.getSelection?.()?.toString() ?? "";

            if (selection !== newSelectedText) setSelection(newSelectedText)
        }, 1500)
        return () => {
            clearInterval(intervalId);
        }
    }, []);

    // const nextThemeTitle = theme === 'dark' ? 'Light' : 'Dark';

    return (
        <div style={{height: isPreview ? '95vh' : '100vh', width: '100vw', position: 'relative', overflow: 'hidden'}}>
            <div style={{
                position: "fixed",
                right: '4px',
                bottom: '4px',
                zIndex: '100',
                width: 'fit-content',
                gap: '5px',
                display: 'flex',
                flexDirection: 'row-reverse'
            }}>
                <Button  mode="bezeled" size="m" style={{opacity: 0.9}}
                        onClick={() => setMenuOpen(!isMenuOpen)}><span style={{ color: '#'}}>Menu ☰</span></Button>
                {isMenuOpen
                    ? (
                        <>
                            {/*<Button mode="filled" size="s"*/}
                            {/*        onClick={() => setTheme(nextThemeTitle.toLocaleLowerCase() as 'dark' | 'light')}>{nextThemeTitle}</Button>*/}
                            <Button mode="bezeled" size="m"
                                    onClick={handleNextTextSize}>{t('reading-overlay.toggle-font-size')}{` ${textSize !== 5 ? '🔼' : '⬇️'}`}</Button>
                            {/*<Button mode="filled" size="s"*/}
                            {/*        onClick={handleOpenChapters}>{t('reading-overlay.chapters')}</Button>)*/}
                        </>)
                    : null}
            </div>
            {selection && book ? (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        bottom: 64,
                        zIndex: 12,
                        background: themeSetting.background,
                        color: themeSetting.text,
                        padding: "12px 14px",
                        borderRadius: 16,
                        boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                        maxWidth: "92%",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                    }}
                >
                    <Text style={{margin: 0, fontWeight: 600}}>{t('reading-overlay.selectionTitle')}</Text>
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        <Button size="s" mode="filled" onClick={handleShareSelection}>
                            {t('reading-overlay.shareSelection')}
                        </Button>
                        <Button size="s" mode="filled" onClick={handleClearSelection}>
                            {t('reading-overlay.clearSelection')}
                        </Button>
                    </div>
                </div>
            ) : null}
            <ReactReader
                // readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                url={fileUrl}
                showToc
                location={location}
                locationChanged={(epubcfi: string) => setLocation(epubcfi)}
                getRendition={(_rendition) => {
                    renditionRef.current = _rendition
                    bookRef.current = _rendition.book;


                    const handleRendered = (_: string, view: any) => {
                        if (view) {
                            readerIframetRef.current = view;
                        }


                    };
                    _rendition.on('rendered', handleRendered);
                }}
            />
        </div>
    );
}

