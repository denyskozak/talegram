import {useCallback, useEffect, useLayoutEffect, useRef, useState} from "react";

import "./ReadingOverlay.css";
import {IReactReaderStyle, ReactReader, ReactReaderStyle} from "react-reader";

import {Rendition, type Contents} from 'epubjs'
import {shareURL} from "@tma.js/sdk";
import {Button} from "@/shared/ui/Button.tsx";
import {useTranslation} from "react-i18next";
import {useTheme} from "@/app/providers/ThemeProvider.tsx";
import {Modal, Text} from "@telegram-apps/telegram-ui";
import type {Book} from "@/entities/book/types";
import {buildMiniAppDirectLink} from "@/shared/lib/telegram.ts";
// import {useMediaQuery} from "@uidotdev/usehooks";
import {hapticFeedback} from '@tma.js/sdk';


const { selectionChanged } = hapticFeedback;

type ReadingOverlayProps = {
    book?: Book | null;
    fileUrl: string;
    onLocationChange: (location: string) => void;
    initialLocation: string
    isPreview: boolean
    mobileFullScreen: boolean
};


type ITheme = 'light' | 'dark'

type TocItem = {
    label: string;
    href: string;
    subitems?: TocItem[];
}


export function ReadingOverlay({
                                   fileUrl,
                                   mobileFullScreen,
                                   initialLocation,
                                   onLocationChange,
                                   isPreview,
                                   book
                               }: ReadingOverlayProps): JSX.Element {
    const [location, setLocation] = useState<string>(initialLocation);
    const {t} = useTranslation();
    const themeSetting = useTheme();
    const bookRef = useRef<any | null>(null);
    const renditionRef = useRef<Rendition | undefined>(undefined)
    const [isMenuOpen, setMenuOpen] = useState(false);
    const [textSize, setTextSize] = useState(3);
    const rendition = useRef<Rendition | undefined>(undefined)
    const [chapters, setChapters] = useState<TocItem[]>([]);
    const [isChaptersModalOpen, setChaptersModalOpen] = useState(false);
    const [chaptersLoading, setChaptersLoading] = useState(false);
    const [isMenuModalVisibleGood, setMenuModalVisibleGood] = useState(true);
    const [currentChapterHref, setCurrentChapterHref] = useState<string | null>(null);
    const [areControlsVisible, setControlsVisible] = useState(true);

    const [selection, setSelection] = useState<string | null>(null);
    const hideHeaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const readerIframetRef = useRef<null | Contents>(null);
    const themeState = useTheme();
    const [theme] = useState<ITheme>('dark')

    useLayoutEffect(() => {
        const timeoutId = setTimeout(() => {
            setMenuModalVisibleGood(false)
        }, 6 * 1000);
        return () => clearTimeout(timeoutId)
    }, []);

    const navLockRef = useRef(false);

    const normalizeHref = (href?: string | null) => href?.split("#")[0] ?? null;

    const isCoverItem = (it: any) => {
        const props = Array.isArray(it?.properties) ? it.properties.join(" ") : String(it?.properties || "");
        const idref = String(it?.idref || "").toLowerCase();
        const href = String(it?.href || "").toLowerCase();
        return props.includes("cover") || idref.includes("cover") || href.includes("cover");
    };

    const getLocKey = (r: any) => {
        const loc = r?.currentLocation?.();
        const idx = loc?.start?.index;
        const cfi = loc?.start?.cfi || loc?.start?.location;
        const href = loc?.start?.href;
        return `${idx ?? "x"}|${href ?? "x"}|${cfi ?? "x"}`;
    };

    const findNextReadableIndex = (items: any[], fromIndex: number) => {
        for (let i = fromIndex + 1; i < items.length; i++) {
            const it = items[i];
            if (it?.linear === "no") continue;
            if (isCoverItem(it)) continue;
            return i;
        }
        return -1;
    };

    const findPrevReadableIndex = (items: any[], fromIndex: number) => {
        for (let i = fromIndex - 1; i >= 0; i--) {
            const it = items[i];
            if (it?.linear === "no") continue;
            if (isCoverItem(it)) continue;
            return i;
        }
        return -1;
    };

    const safeNext = async () => {
        const r: any = renditionRef.current;
        if (!r || navLockRef.current) return;
        navLockRef.current = true;

        try {
            await r.book?.ready;

            const beforeKey = getLocKey(r);
            await r.next();

            // Дадим epubjs шанс обновить currentLocation
            await new Promise((res) => setTimeout(res, 0));

            const afterKey = getLocKey(r);
            if (afterKey !== beforeKey) return; // нормальный переход сработал

            // Если "залипли" (часто Cover) — прыгаем на следующий readable spine item
            const spine = r.book?.spine;
            const items: any[] = spine?.items || [];
            const idx = r.currentLocation?.()?.start?.index ?? 0;

            const nextIdx = findNextReadableIndex(items, idx);
            if (nextIdx !== -1) {
                await r.display(items[nextIdx].href);
            }
            selectionChanged.ifAvailable();
        } finally {
            navLockRef.current = false;
        }
    };

    const safePrev = async () => {
        const r: any = renditionRef.current;
        if (!r || navLockRef.current) return;
        navLockRef.current = true;

        try {
            await r.book?.ready;

            const beforeKey = getLocKey(r);
            await r.prev();

            await new Promise((res) => setTimeout(res, 0));

            const afterKey = getLocKey(r);
            if (afterKey !== beforeKey) return;

            const spine = r.book?.spine;
            const items: any[] = spine?.items || [];
            const idx = r.currentLocation?.()?.start?.index ?? 0;

            const prevIdx = findPrevReadableIndex(items, idx);
            if (prevIdx !== -1) {
                await r.display(items[prevIdx].href);
            }
            selectionChanged.ifAvailable();
        } finally {
            navLockRef.current = false;
        }
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") {
                e.preventDefault();
                safeNext();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                safePrev();
            }
        };

        window.addEventListener("keydown", onKeyDown, {passive: false});
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    function updateTheme(rendition: Rendition) {
        const themes = rendition.themes
        themes.override('color', themeState.text)
        themes.override('background', themeState.background)
    }

    const readerTheme: IReactReaderStyle = {
        ...ReactReaderStyle,

        container: {
            ...ReactReaderStyle.container,
            padding: '20px 0 12px 0'
        },
        readerArea: {
            ...ReactReaderStyle.readerArea,
            backgroundColor: themeState.background,
            transition: undefined,
        },
        reader: {
            ...ReactReaderStyle.reader,
            color: themeState.background,
            transition: undefined,
            inset: 0,
        },

        // arrow: {
        //     ...ReactReaderStyle.arrow,
        //     color: themeState.accent,
        // },
        // arrowHover: {
        //     ...ReactReaderStyle.arrowHover,
        //     color: themeState.section,
        // },
        arrow: {
            ...ReactReaderStyle.arrow,
            color: themeState.accent,
            display: "none",
        },
        arrowHover: {
            ...ReactReaderStyle.arrowHover,
            color: themeState.section,
            display: "none",
        },

        tocArea: {
            ...ReactReaderStyle.tocArea,
            backgroundColor: themeState.background,
            marginTop: '10vh'
        },
        tocButton: {
            ...ReactReaderStyle.tocButton,
            top: mobileFullScreen ? '12vh' : ReactReaderStyle.tocButton.top,
            left: '3vw',
            transform: "scale(1.4)",
            backgroundColor: themeState.accent,
        },


    }

    useEffect(() => {
        if (rendition.current) {
            updateTheme(rendition.current)
        }
    }, [theme])

    const clearHideHeaderTimeout = () => {
        if (hideHeaderTimeoutRef.current) {
            clearTimeout(hideHeaderTimeoutRef.current);
            hideHeaderTimeoutRef.current = null;
        }
    };

    const clearHideControlsTimeout = useCallback(() => {
        if (hideControlsTimeoutRef.current) {
            clearTimeout(hideControlsTimeoutRef.current);
            hideControlsTimeoutRef.current = null;
        }
    }, []);

    const scheduleHideControls = useCallback(() => {
        clearHideControlsTimeout();
        hideControlsTimeoutRef.current = setTimeout(() => {
            setControlsVisible(false);
            setMenuOpen(false);
        }, 5000);
    }, [clearHideControlsTimeout]);

    const handleRevealControls = useCallback(() => {
        setControlsVisible(true);
        scheduleHideControls();
    }, [scheduleHideControls]);


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
    useEffect(() => {
        scheduleHideControls();
        return () => clearHideControlsTimeout();
    }, [scheduleHideControls, clearHideControlsTimeout]);

    const handleNextTextSize = () => {
        const next = textSize + 1 > 5 ? 1 : textSize + 1;
        setTextSize(next);
        selectionChanged.ifAvailable()
    }

    const handleOpenChapters = () => {
        setChaptersModalOpen(true);
        selectionChanged.ifAvailable()
    }

    const handleCloseChapters = () => {
        setChaptersModalOpen(false);
        selectionChanged.ifAvailable()
    }
    const handleClearSelection = useCallback(() => {


        setSelection(null);
        selectionChanged.ifAvailable()
    }, [selection]);

    const handleShareSelection = useCallback(() => {
        if (!selection || !book) {
            return;
        }
        selectionChanged.ifAvailable()
        const excerpt = `\n\n“${selection}”\n\nExcerpt From\n${book.title}\n${book.authors.join(', ')}\nThis material may be protected by copyright`;
        const startParamParts = [`reader_${book.id}_books`];

        if (book.price !== 0) {
            startParamParts.push("preview_1");
        }

        const deepLink = buildMiniAppDirectLink({
            startParam: startParamParts.join("_"),
            botUsername: 'talegram_org_bot'
        });

        try {
            shareURL(deepLink ?? '', excerpt);
        } catch (error) {
            console.error("Failed to share selection", error);
        }
    }, [book, selection]);

    useEffect(() => {
        onLocationChange?.(location)
        setCurrentChapterHref(normalizeHref(renditionRef.current?.location?.start?.href ?? null));
    }, [location]);

    useEffect(() => {
        const intervalId = setInterval(() => {
            if (!readerIframetRef.current) return;

            const newSelectedText = (readerIframetRef?.current as unknown as {
                window: Window
            })?.window?.getSelection?.()?.toString() ?? "";

            if (selection !== newSelectedText) setSelection(newSelectedText)
        }, 1500)
        return () => {
            clearInterval(intervalId);
        }
    }, []);


    // const nextThemeTitle = theme === 'dark' ? 'Light' : 'Dark';

    const injectCss = (contents: { document: Document }) => {
        const doc = contents.document;

        // удалим старый стиль, если он уже был
        const prev = doc.getElementById("app-link-fix");
        if (prev) prev.remove();

        const style = doc.createElement("style");
        style.id = "app-link-fix";
        style.type = "text/css";
        style.appendChild(
            doc.createTextNode(`    
            
        
        /* максимальная "пробивная" сила */
        a, a:link, a:visited,
        .calibre6 a, a.calibre6,
        [class*="calibre"] a {
          color: ${themeState.accent} !important;
          text-decoration: underline !important;
        }
        a:hover, a:active {
          opacity: 0.85 !important;
        }
        h1, h2, h3, h4, h5, h6, p, blockquote, pre { 
          background-color: transparent !important;
        }    
        iframe { pointer-events: auto !important; }

      `)
        );

        // ВАЖНО: добавляем в КОНЕЦ head, чтобы быть последними по каскаду
        doc.head.appendChild(style);
    };

    const loadChapters = (r: Rendition) => {
        const book = r.book;
        if (!book) return;
        setChaptersLoading(true);
        book.loaded.navigation
            .then((nav: { toc?: TocItem[] }) => {
                setChapters(nav?.toc ?? []);
            })
            .catch((error: unknown) => {
                console.error("Failed to load chapters", error);
                setChapters([]);
            })
            .finally(() => setChaptersLoading(false));
    };

    const handleChapterSelect = (href: string) => {
        if (!renditionRef.current) return;
        setChaptersModalOpen(false);
        renditionRef.current.display(href);
    };

    const renderToc = (items: TocItem[], depth = 0) => {
        if (!items?.length) return null;
        return items.map((item) => {
            const isActive = normalizeHref(item.href) === currentChapterHref;
            return (
                <div key={`${item.href}-${depth}`} style={{display: "flex", flexDirection: "column", gap: 4}}>
                    <Button
                        mode={isActive ? "filled" : "outline"}
                        size="m"
                        onClick={() => handleChapterSelect(item.href)}
                        style={{
                            justifyContent: "flex-start",
                            textAlign: "left",
                            paddingLeft: 12 + depth * 12,
                            paddingRight: 12,
                            whiteSpace: "normal",
                        }}
                    >
                        <span style={{overflow: "hidden", textOverflow: "ellipsis", display: "block", width: "100%"}}>
                            {item.label || t("reading-overlay.chapterUnnamed")}
                        </span>
                    </Button>
                    {item.subitems ? (
                        <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                            {renderToc(item.subitems, depth + 1)}
                        </div>
                    ) : null}
                </div>
            );
        });
    };


    return (
        <div
            style={{height: isPreview ? '95vh' : '100vh', width: '100vw', position: 'relative', overflow: 'hidden'}}
            onPointerDown={handleRevealControls}
            onTouchEnd={handleRevealControls}
        >
            {areControlsVisible ? (
                <>
                    <button
                        type="button"
                        onClick={safePrev}
                        aria-label="Previous"
                        style={{
                            position: "absolute",
                            left: '2vw',
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 2,
                            border: "none",
                            width: 44,
                            height: 44,
                            backgroundColor: themeState.background,
                            opacity: 0.85,
                            cursor: "pointer",
                            fontSize: 32,
                        }}
                    >
                        ⬅️
                    </button>

                    {/* ПРАВАЯ стрелка */}
                    <button
                        type="button"
                        onClick={safeNext}
                        aria-label="Next"
                        style={{
                            position: "absolute",
                            right: '2vw',
                            top: "50%",
                            transform: "translateY(-50%)",
                            zIndex: 2,
                            border: "none",
                            width: 44,
                            height: 44,
                            backgroundColor: themeState.background,
                            opacity: 0.85,
                            cursor: "pointer",
                            fontSize: 32,
                        }}
                    >
                        ➡️
                    </button>
                </>
            ) : null}
            <div style={{
                position: "fixed",
                top: '16vh',
                right: '1vh',
                zIndex: '100',
                width: 'fit-content',
                gap: '5px',
                display: 'flex',
                flexDirection: 'row-reverse'
            }}>
                {areControlsVisible ? (
                    <>
                        <button style={{
                            background: isMenuModalVisibleGood ? themeState.accent : themeState.background,
                            border: 'none',
                            borderRadius: 900,
                            opacity: 0.9
                        }}
                                onClick={() => {
                                    setMenuOpen(!isMenuOpen);
                                    selectionChanged.ifAvailable();
                                }}><span style={{fontSize: 24}}>⚙️</span></button>
                        {isMenuOpen && !isChaptersModalOpen
                            ? (
                                <>
                                    {/*<Button mode="filled" size="s"*/}
                                    {/*        onClick={() => setTheme(nextThemeTitle.toLocaleLowerCase() as 'dark' | 'light')}>{nextThemeTitle}</Button>*/}
                                    <Button mode="filled" size="s"
                                            onClick={handleNextTextSize}>{t('reading-overlay.toggle-font-size')}{` ${textSize !== 5 ? '🔼' : '⬇️'}`}</Button>
                                    <Button mode="filled" size="s"
                                            onClick={handleOpenChapters}>{t('reading-overlay.chapters')}</Button>
                                </>)
                            : null}
                    </>
                ) : null}
            </div>
            <Modal

                header={<Modal.Header>{t("reading-overlay.chapters")}</Modal.Header>} open={isChaptersModalOpen}
                onOpenChange={setChaptersModalOpen}>

                <div style={{height: '60vh', padding: 16, display: "flex", flexDirection: "column", gap: 12}}>
                    {chaptersLoading ? (
                        <Text>{t("reading-overlay.chaptersLoading")}</Text>
                    ) : chapters.length ? (
                        renderToc(chapters)
                    ) : (
                        <Text>{t("reading-overlay.noChapters")}</Text>
                    )}
                    <Button mode="outline" onClick={handleCloseChapters}>
                        {t("reading-overlay.closeChapters")}
                    </Button>
                </div>
            </Modal>
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
                showToc={false}
                location={location}
                locationChanged={(epubcfi: string) => setLocation(epubcfi)}
                readerStyles={readerTheme}

                getRendition={(_rendition) => {
                    updateTheme(_rendition)

                    renditionRef.current = _rendition
                    bookRef.current = _rendition.book;
                    _rendition.hooks.content.register(injectCss);
                    loadChapters(_rendition);


                    const handleRendered = (_: string, view: Contents) => {
                        if (view) {
                            readerIframetRef.current = view;
                        }

                        const doc = view.document;

                        const links = Array.from(doc.querySelectorAll("a"));
                        console.log("links: ", links);
                        links.forEach((a) => {
                            const href = a.getAttribute("href");
                            console.log("href: ", href);
                            if (!href) return;

                            // пропускаем внутреннюю навигацию EPUB
                            if (
                                href.startsWith("#") ||
                                href.startsWith("epubcfi(")
                            ) {
                                return;
                            }

                            // 1️⃣ убираем стандартное поведение
                            a.removeAttribute("href");

                            // 2️⃣ делаем ссылку "кнопкой"
                            a.setAttribute("role", "link");
                            a.style.cursor = "pointer";

                            // 3️⃣ вешаем своё поведение

                            function logAllEvents(el: EventTarget, label = "") {
                                const events = [
                                    // mouse
                                    "click", "mousedown", "mouseup",
                                    "mouseenter", "mouseleave", "mouseover", "mouseout",

                                    // touch
                                    "touchstart", "touchmove", "touchend", "touchcancel",

                                    // pointer
                                    "pointerdown", "pointermove", "pointerup", "pointercancel",

                                    // keyboard
                                    "keydown", "keyup",

                                    // focus
                                    "focus", "blur",

                                    // misc
                                    "contextmenu",
                                ];

                                const handler = (e: Event) => {
                                    console.log(`[${label}]`, e.type, e);
                                };

                                events.forEach((ev) =>
                                    el.addEventListener(ev, handler, {capture: true})
                                );


                            }

                            logAllEvents(a)

                        });
                    };
                    _rendition.on('rendered', handleRendered);
                }}
            />
        </div>
    );
}
