import {useEffect, useRef, useState} from "react";

import "./ReadingOverlay.css";
import {IReactReaderStyle, ReactReader, ReactReaderStyle} from "react-reader";

import {type Rendition} from 'epubjs'
import {Button} from "@/shared/ui/Button.tsx";
import {useTranslation} from "react-i18next";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";

type ReadingOverlayProps = {
    fileUrl: string;
    onLocationChange: (location: string) => void;
    initialLocation: string
};

type ITheme = 'light' | 'dark'

function updateTheme(rendition: Rendition, theme: ITheme) {
    const themes = rendition.themes
    switch (theme) {
        case 'dark': {
            themes.override('color', '#fff')
            themes.override('background', '#000')
            break
        }
        case 'light': {
            themes.override('color', '#000')
            themes.override('background', '#fff')
            break
        }
    }
}

export function ReadingOverlay({fileUrl, initialLocation, onLocationChange}: ReadingOverlayProps): JSX.Element {
    const [location, setLocation] = useState<string>(initialLocation);
    const {t} = useTranslation();
    const themeSetting = useTheme();

    const rendition = useRef<Rendition | undefined>(undefined)
    const [theme, setTheme] = useState<ITheme>(themeSetting.text === '#ffffff' ? 'dark' : 'light');
    const [textSize, setTextSize] = useState(1);

    useEffect(() => {
        if (rendition.current) {
            updateTheme(rendition.current, theme)
        }
    }, [theme])

    useEffect(() => {
        const textSizes: Record<number, string> = {
            1: '100%',
            2: '140%',
            3: '160%',
        }
        rendition.current?.themes.fontSize(textSizes[textSize])
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
            backgroundColor: '#212121',
            transition: undefined,
        },
        titleArea: {
            ...ReactReaderStyle.titleArea,
            color: '#ccc',
        },
        tocArea: {
            ...ReactReaderStyle.tocArea,
            background: '#111',
        },
        tocButtonExpanded: {
            ...ReactReaderStyle.tocButtonExpanded,
            background: '#222',
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
                    rendition.current = _rendition
                }}
            />
        </div>
    );
}

