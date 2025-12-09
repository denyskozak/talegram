import {useEffect, useRef, useState} from "react";

import "./ReadingOverlay.css";
import {IReactReaderStyle, ReactReader, ReactReaderStyle} from "react-reader";

import {type Rendition} from 'epubjs'
import {Button} from "@/shared/ui/Button.tsx";
import {useTranslation} from "react-i18next";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";
import {DisplayedLocation} from "epubjs/types/rendition";

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

    const darkText = isDefaultThemeDark ? themeSetting.text : '#fff'
    const lightText = isDefaultThemeDark ? '#000' : themeSetting.text
    const darkBackground = isDefaultThemeDark ? themeSetting.background : '#212121'
    const lightBackground = isDefaultThemeDark ? '#fff' : themeSetting.background

    function updateTheme(rendition: Rendition, theme: ITheme) {
        const themes = rendition.themes
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
        }
        renditionRef.current?.themes.fontSize(textSizes[textSize])
    }, [textSize])

    const handleNextTextSize = () => {
        const next = textSize + 1 > 3 ? 1 : textSize + 1;
        setTextSize(next);
    }

    useEffect(() => {
        onLocationChange?.(location)
    }, [location]);

    const nextThemeTitle = theme === 'dark' ? 'Light' : 'Dark';

    const lightReaderTheme: IReactReaderStyle = {
        ...ReactReaderStyle,
        arrow: {
            ...ReactReaderStyle.arrow,
            color: 'black',
        },
        readerArea: {
            ...ReactReaderStyle.readerArea,
            transition: undefined,
        },
        tocButtonBar: {
            ...ReactReaderStyle.tocButtonBar,
            background: 'black',
        },
    }

    const darkReaderTheme: IReactReaderStyle = {
        ...ReactReaderStyle,
        arrow: {
            ...ReactReaderStyle.arrow,
            color: 'white',
        },
        arrowHover: {
            ...ReactReaderStyle.arrowHover,
            color: '#ccc',
        },
        readerArea: {
            ...ReactReaderStyle.readerArea,
            backgroundColor: darkBackground,
            transition: undefined,
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

    const goToNextChapter = () => {
        const rendition = renditionRef.current;
        const book = bookRef.current;

        console.log("rendition: ", rendition);
        console.log("book: ", book);
        if (!rendition || !book) return;

        const currentLocation = rendition.currentLocation();
        console.log("currentLocation: ", currentLocation);
        const currentHref = (currentLocation as unknown as { start: DisplayedLocation })?.start?.href;
        if (!currentHref) return;

        const spineItems = book.spine?.spineItems || [];
        console.log("spineItems: ", spineItems);
        if (!spineItems.length) return;

        const currentIndex = spineItems.findIndex((item: any) =>
            item.href === currentHref ||
            item.href.endsWith(currentHref) ||
            currentHref.endsWith(item.href)
        );

        console.log("currentIndex: ", currentIndex);
        if (currentIndex === -1) return;

        const nextItem = spineItems[currentIndex + 1];
        console.log("nextItem: ", nextItem);
        if (!nextItem) {
            // уже в последней главе
            return;
        }

        rendition.display(nextItem.href);
    };

    return (
        <div style={{height: '90vh', position: 'relative'}}>
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
            <ReactReader
                readerStyles={theme === 'dark' ? darkReaderTheme : lightReaderTheme}
                url={fileUrl}
                location={location}
                locationChanged={(epubcfi: string) => setLocation(epubcfi)}
                getRendition={(_rendition) => {
                    updateTheme(_rendition, theme)
                    renditionRef.current = _rendition

                    bookRef.current = _rendition.book;

                    _rendition.on('relocated', (loc: any) => {
                        // обычное обновление позиции
                        if (loc?.start?.cfi) {
                            setLocation(loc.start.cfi);
                        }

                        const displayed = loc.end?.displayed || loc.start?.displayed;
                        console.log("displayed: ", displayed);
                        // если данные об отображении есть и мы на последней странице раздела — считаем, что конец главы
                        if (displayed && displayed.page === displayed.total) {
                            goToNextChapter();
                        }
                    });
                }}
            />
        </div>
    );
}

