import {useCallback, useEffect, useRef, useState} from "react";

import "./ReadingOverlay.css";
import {IReactReaderStyle, ReactReader, ReactReaderStyle} from "react-reader";

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
};

type ITheme = 'light' | 'dark'


export function ReadingOverlay({fileUrl, initialLocation, onLocationChange, book}: ReadingOverlayProps): JSX.Element {
    const [location, setLocation] = useState<string>(initialLocation);
    const {t} = useTranslation();
    const themeSetting = useTheme();
    const bookRef = useRef<any | null>(null);
    const renditionRef = useRef<Rendition | undefined>(undefined)
    const isDefaultThemeDark = themeSetting.text === '#ffffff' || themeSetting.text === '#FFFFFF';
    const [theme, setTheme] = useState<ITheme>(isDefaultThemeDark ? 'dark' : 'light');
    const [isMenuOpen, setMenuOpen] = useState(false);
    const [textSize, setTextSize] = useState(3);

    const [selection, setSelection] = useState<string | null>(null);

    const darkText = isDefaultThemeDark ? themeSetting.text : '#fff'
    const lightText = isDefaultThemeDark ? '#000' : themeSetting.text
    const darkBackground = isDefaultThemeDark ? themeSetting.background : '#212121'
    const lightBackground = isDefaultThemeDark ? '#fff' : themeSetting.background


    function updateTheme(rendition: Rendition, theme: ITheme) {
        const themes = rendition.themes

        applyLayoutOverrides(rendition);

        switch (theme) {
            case 'dark': {
                themes.override('color', darkText)
                themes.override('background', darkBackground)
                break
            }
            case 'light': {
                themes.override('color', lightText)
                themes.override('background', lightBackground)
                break
            }
        }
    }


    useEffect(() => {
        if (renditionRef.current) {
            updateTheme(renditionRef.current, theme)
        }
    }, [theme])

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

        const excerpt = `“${selection}”\n\nExcerpt From\n${book.title}\n${book.authors.join(', ')}\nThis material may be protected by copyright`;
        const deepLink =
            buildMiniAppDirectLink({startParam: `reader_${book.id}_books_${book.price === 0 ? '' : 'preview_1'}` , botUsername: 'talegram_org_bot'}) ;

        try {
            shareURL(deepLink ?? '', excerpt);
        } catch (error) {
            console.error("Failed to share selection", error);
        }
    }, [selection]);

    useEffect(() => {
        onLocationChange?.(location)
    }, [location]);

    const nextThemeTitle = theme === 'dark' ? 'Light' : 'Dark';

    const baseReaderStyle: IReactReaderStyle = {
        ...ReactReaderStyle,
        // контейнер самого ридера – растянем по ширине
        container: {
            ...ReactReaderStyle.container,
            maxWidth: '100vw',
            width: '100vw',
            height: '100%',
            margin: 0,
            overflow: 'hidden',
        },
        // область чтения без отступов
        readerArea: {
            ...ReactReaderStyle.readerArea,
            margin: 0,
            padding: 0,
            height: '100%',
            inset: 0,
            overflow: 'hidden',
        },
        // стрелки навигации – полностью отключаем
        arrow: {
            ...ReactReaderStyle.arrow,
            display: 'none',
            pointerEvents: 'none',
            width: 0,
        },
        arrowHover: {
            ...ReactReaderStyle.arrowHover,
            display: 'none',
            pointerEvents: 'none',
            width: 0,
        },
        reader: {
            ...ReactReaderStyle.reader,
            inset: '0 16px'
        },
    }


    const lightReaderTheme: IReactReaderStyle = {
        ...baseReaderStyle,
        readerArea: {
            ...baseReaderStyle.readerArea,
            backgroundColor: lightBackground,
        },
        tocButtonBar: {
            ...ReactReaderStyle.tocButtonBar,
            background: 'black',
        },
    }

    const darkReaderTheme: IReactReaderStyle = {
        ...baseReaderStyle,


        readerArea: {
            ...baseReaderStyle.readerArea,
            backgroundColor: darkBackground,
        },
        titleArea: {
            ...ReactReaderStyle.titleArea,
            color: '#ccc',
        },
        tocArea: {
            ...ReactReaderStyle.tocArea,
            background: '#212121',
        },
        tocButtonExpanded: {
            ...ReactReaderStyle.tocButtonExpanded,
            background: '#212121',
        },
        tocButtonBar: {
            ...ReactReaderStyle.tocButtonBar,
            background: themeSetting.text,
            opacity: 0.9,
            zIndex: 3,

        },
        tocButton: {
            ...ReactReaderStyle.tocButton,
            color: 'white',
        },
    }

    const epubViewStyles = {
        view: {
            // внутренний canvas epub.js
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0,
        },
        viewHolder: {
            // внутренний canvas epub.js
            width: '100%',
            height: '100%',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
        },
    }

    function applyLayoutOverrides(rendition: Rendition) {
        const themes = rendition.themes;

        themes.register('no-margins', {
            'html': {
                margin: '0 !important',
                padding: '0 !important',
            },
            'body': {
                margin: '0 !important',
                padding: '0 !important',
                maxWidth: '100vw !important',
                width: '100vw !important',
                overflowX: 'hidden !important',
            },
        });

        themes.select('no-margins');
    }


    console.log("selection: ", selection);
    console.log("darkBackground: ", darkBackground);
    return (
        <div style={{height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden'}}>
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
                <Button mode="filled" size="m" style={{opacity: 0.9, background: darkBackground}}
                        onClick={() => setMenuOpen(!isMenuOpen)}><span style={{ color: '#'}}>Menu ☰</span></Button>
                {isMenuOpen
                    ? (
                        <>
                            <Button mode="filled" size="s"
                                    onClick={() => setTheme(nextThemeTitle.toLocaleLowerCase() as 'dark' | 'light')}>{nextThemeTitle}</Button>
                            <Button mode="filled" size="s"
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
                readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                url={fileUrl}
                showToc
                location={location}
                epubOptions={{
                    flow: "scrolled-doc",
                    manager: "continuous",
                    spread: "none",
                }}
                epubViewStyles={epubViewStyles}

                locationChanged={(epubcfi: string) => setLocation(epubcfi)}
                getRendition={(_rendition) => {
                    renditionRef.current = _rendition
                    bookRef.current = _rendition.book;


                    // затем накатываем твой цветовой theme
                    updateTheme(_rendition, theme);

                    const handleRendered = (_: string, contents: any) => {
                        console.log("222: ", 222);
                        setInterval(() => {
                            const selectedText = contents?.window?.getSelection?.()?.toString() ?? "";
                            console.log("selectedText: ", selectedText);


                            console.log("8: ", 8);
                            setSelection(selectedText.trim());
                        }, 1000)
                    };
                    _rendition.on('rendered', handleRendered);
                }}
            />
        </div>
    );
}

