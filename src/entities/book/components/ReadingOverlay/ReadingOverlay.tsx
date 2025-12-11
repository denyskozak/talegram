import {useCallback, useEffect, useRef, useState} from "react";

import "./ReadingOverlay.css";
import {IReactReaderStyle, ReactReader, ReactReaderStyle} from "react-reader";

import {type Rendition} from 'epubjs'
import {shareURL} from "@tma.js/sdk";
import {Button} from "@/shared/ui/Button.tsx";
import {useTranslation} from "react-i18next";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";
import {Text} from "@telegram-apps/telegram-ui";
type ReadingOverlayProps = {
    fileUrl: string;
    onLocationChange: (location: string) => void;
    initialLocation: string
};

type ITheme = 'light' | 'dark'


export function ReadingOverlay({fileUrl, initialLocation, onLocationChange}: ReadingOverlayProps): JSX.Element {
    const [location, setLocation] = useState<string>(initialLocation);
    const {t} = useTranslation();
    const themeSetting = useTheme();
    console.log("themeSetting: ", themeSetting);
    const bookRef = useRef<any | null>(null);
    const renditionRef = useRef<Rendition | undefined>(undefined)
    const isDefaultThemeDark = themeSetting.text === '#ffffff' || themeSetting.text === '#FFFFFF';
    const [theme, setTheme] = useState<ITheme>(isDefaultThemeDark ? 'dark' : 'light');
    const [textSize, setTextSize] = useState(2);
    const [selection, setSelection] = useState<{ cfiRange: string; text: string } | null>(null);

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
            1: '100%',
            2: '140%',
            3: '160%',
            4: '200%',
        }
        renditionRef.current?.themes.fontSize(textSizes[textSize])
    }, [textSize])

    useEffect(() => {
        const rendition = renditionRef.current;
        if (!rendition) {
            return;
        }

        const handleSelected = (cfiRange: string, contents: any) => {
            const selectedText = contents?.window?.getSelection?.()?.toString() ?? "";

            if (!selectedText.trim()) {
                setSelection(null);
                return;
            }

            if (selection?.cfiRange) {
                rendition.annotations.remove(selection.cfiRange, 'highlight');
            }

            rendition.annotations.highlight(
                cfiRange,
                {},
                () => rendition.annotations.remove(cfiRange, 'highlight'),
                'highlight',
            );

            setSelection({cfiRange, text: selectedText.trim()});
            contents?.window?.getSelection?.()?.removeAllRanges();
        };

        rendition.on('selected', handleSelected);

        return () => rendition.off('selected', handleSelected);
    }, [selection]);

    const handleNextTextSize = () => {
        const next = textSize + 1 > 4 ? 1 : textSize + 1;
        setTextSize(next);
    }

    const handleClearSelection = useCallback(() => {
        if (selection?.cfiRange && renditionRef.current) {
            renditionRef.current.annotations.remove(selection.cfiRange, 'highlight');
        }

        setSelection(null);
    }, [selection]);

    const handleShareSelection = useCallback(() => {
        if (!selection?.text) {
            return;
        }

        const excerpt = `“${selection.text}”`;

        try {
            shareURL(window.location.href, excerpt);
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
            maxWidth: '100%',
            width: '100%',
            margin: 0,
        },
        // область чтения без отступов
        readerArea: {
            ...ReactReaderStyle.readerArea,
            margin: 0,
            padding: 0,
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
            background: '#fff',
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
                maxWidth: '100% !important',
            },
        });

        themes.select('no-margins');
    }


    return (
        <div style={{height: '90vh', width: '100%', position: 'relative'}}>
            <div style={{
                position: "absolute",
                right: '4px',
                bottom: '4px',
                zIndex: '10',
                width: 'fit-content',
                gap: '5px',
                display: 'flex',
                flexDirection: 'row-reverse'
            }}>
                <Button mode="bezeled" size="s"
                        onClick={() => setTheme(nextThemeTitle.toLocaleLowerCase() as 'dark' | 'light')}>{nextThemeTitle}</Button>
                <Button mode="bezeled" size="s"
                        onClick={handleNextTextSize}>{t('reading-overlay.toggle-font-size')}{` ${textSize === 1 || textSize === 2 ? '🔼' : '⬇️'}`}</Button>
            </div>
            {selection ? (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        bottom: 64,
                        zIndex: 12,
                        background: "var(--tg-theme-bg-color, #ffffff)",
                        color: "var(--tg-theme-text-color, #000000)",
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
                    <Text style={{margin: 0, maxHeight: 150, overflow: "auto"}}>
                        {selection.text}
                    </Text>
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        <Button size="s" mode="filled" onClick={handleShareSelection}>
                            {t('reading-overlay.shareSelection')}
                        </Button>
                        <Button size="s" mode="outline" onClick={handleClearSelection}>
                            {t('reading-overlay.clearSelection')}
                        </Button>
                    </div>
                </div>
            ) : null}
            <ReactReader
                readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                url={fileUrl}
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

                }}
            />
        </div>
    );
}

