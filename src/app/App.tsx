import {BrowserRouter, useLocation, useNavigate} from "react-router-dom";
import {useEffect, useState, type TransitionEvent} from "react";
import {useTranslation} from "react-i18next";

import {AppRoot} from "@telegram-apps/telegram-ui";
import { init } from '@tma.js/sdk';

import {TMAProvider, useTMA} from "./providers/TMAProvider";
import {useTheme} from "./providers/ThemeProvider";
import {AppRouter} from "./router";
import {ToastProvider} from "@/shared/ui/ToastProvider";
import {DemoBanner} from "@/shared/ui/DemoBanner";
import {FooterBar} from "@/widgets/FooterBar/FooterBar";
import {HeaderBar} from "@/widgets/HeaderBar/HeaderBar";
import {useFooterVisibility, useHeaderVisibility} from "@/shared/hooks/useFooterVisibility";
import {useLaunchParams} from "@tma.js/sdk-react";
import {StartRouteHandler} from "@/app/StartHandler.tsx";
import { swipeBehavior } from '@tma.js/sdk';

function SplashScreen({visible}: { visible: boolean }): JSX.Element | null {
    const [shouldRender, setShouldRender] = useState(visible);
    const theme = useTheme();
    const {t} = useTranslation();

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
        }
    }, [visible]);

    const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
        if (event.propertyName === "opacity" && !visible) {
            setShouldRender(false);
        }
    };

    if (!shouldRender) {
        return null;
    }

    return (
        <div
            onTransitionEnd={handleTransitionEnd}
            style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.background,
                zIndex: 9999,
                width: "100%",
                height: "100%",
                opacity: visible ? 1 : 0,
                transition: "opacity 400ms ease",
                pointerEvents: visible ? "auto" : "none",
            }}
        >
            {/*<div*/}
            {/*  style={{*/}
            {/*    width: 126,*/}
            {/*    height: 126,*/}
            {/*    borderRadius: "50%",*/}
            {/*    backgroundColor: "#fff",*/}
            {/*    display: "flex",*/}
            {/*    alignItems: "center",*/}
            {/*    justifyContent: "center",*/}
            {/*  }}*/}
            {/*>*/}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 20,
                    textAlign: "center",
                }}
            >
                <img
                    src="/logo-v-1.webp"
                    alt="Open Reader logo"
                    style={{
                        width: 96,
                        height: 96,
                        objectFit: "contain",
                    }}
                />
                <div style={{display: "flex", flexDirection: "column", gap: 4}}>
                    <span style={{fontSize: 24, fontWeight: 600,      color: theme.text,}}>
                        {t("splashScreen.title")}
                    </span>
                </div>
                <div
                    style={{
                        position: "absolute",
                        bottom: '5%',
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 8,
                        color: theme.text,
                        fontSize: 20,
                    }}
                >
                    <span>{t("splashScreen.subtitle")}</span>
                    {/*<span style={{fontWeight: 600}}>{t("app.name")}</span>*/}
                </div>
            </div>
            {/*</div>*/}
        </div>
    );
}

function NavigationControls(): null {
    const location = useLocation();
    const navigate = useNavigate();
    const {backButton, isTelegram} = useTMA();

    useEffect(() => {
        if (!isTelegram) {
            return;
        }

        const handleBack = () => {
            navigate(-1);
        };

        if (!backButton.isMounted()) backButton.mount();

        if (location.pathname === "/") {
            backButton.hide();
            backButton.offClick(handleBack);
        } else {
            backButton.show();
            backButton.offClick(handleBack);
            backButton.onClick(handleBack);
        }

        return () => {
            backButton.offClick(handleBack);
        };
    }, [backButton, isTelegram, location.pathname, navigate]);

    return null;
}

function AppContent(): JSX.Element {
    const {isTelegram} = useTMA();
    const theme = useTheme();
    const {tgWebAppFullscreen, tgWebAppPlatform} = useLaunchParams();
    const [isSplashVisible, setIsSplashVisible] = useState(true);
    const isFooterVisible = useFooterVisibility();
    const isHeaderVisible = useHeaderVisibility();

    useEffect(() => {
        console.log("swipeBehavior: ", swipeBehavior.isSupported());
        if (swipeBehavior.isSupported() ) {
            if (!swipeBehavior.isMounted()) swipeBehavior.mount();;
            swipeBehavior.disableVertical();
        }
        const timeoutId = window.setTimeout(() => {
            setIsSplashVisible(false);
        }, 2000);


        return () => {
            clearTimeout(timeoutId);
        };
    }, []);
    const isDefaultThemeDark = theme.text === "#ffffff" || theme.text === "#FFFFFF";
    console.log("isDefaultThemeDark: ", isDefaultThemeDark);
    return (

        <AppRoot
            className="asd"
            style={{
                paddingTop: tgWebAppFullscreen && tgWebAppPlatform === 'ios' ? "5vh" : 0,
                background: theme.background,
                color: theme.text,
                height: "100dvh",
                width: "100dvw",
            }}
            appearance={isDefaultThemeDark ? 'dark' : 'light'}
        >
            <ToastProvider>
                <div
                    style={{
                        minHeight: "100dvh",
                        display: "flex",
                        flexDirection: "column",
                        background: theme.background,
                    }}
                >
                    {isHeaderVisible && <HeaderBar/>}
                    <main style={{flex: 1, width: "100%"}}>
                        <DemoBanner visible={!isTelegram}/>
                        <div style={{paddingBottom: 24}}>
                            <AppRouter/>
                        </div>
                    </main>
                    {isFooterVisible && <FooterBar/>}
                </div>
                <NavigationControls/>
            </ToastProvider>
            <SplashScreen visible={isSplashVisible}/>
        </AppRoot>

    );
}

void init();

export default function App(): JSX.Element {
    return (
        <BrowserRouter>
            <StartRouteHandler />
                <TMAProvider>
                            <AppContent/>
                </TMAProvider>
        </BrowserRouter>
    );
}
