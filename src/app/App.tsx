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

function SplashScreen({visible}: { visible: boolean }): JSX.Element | null {
    const [shouldRender, setShouldRender] = useState(visible);
    const {theme} = useTMA();
    const backgroundColor = theme?.bg_color ?? "#fdfdfd";
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
                backgroundColor,
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
                    gap: 12,
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
                    <span style={{fontSize: 18, fontWeight: 600}}>
                        {t("splashScreen.titleRu")}
                    </span>
                    <span style={{fontSize: 16, color: "#606060"}}>
                        {t("splashScreen.titleEn")}
                    </span>
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 8,
                        color: "#606060",
                        fontSize: 14,
                    }}
                >
                    <span>{t("splashScreen.decentralizedBy")}</span>
                    <img
                        src="/walrus_logo.svg"
                        alt="Walrus logo"
                        style={{height: 24, objectFit: "contain"}}
                    />
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
    const [isSplashVisible, setIsSplashVisible] = useState(true);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setIsSplashVisible(false);
        }, 1500);
        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    return (

        <AppRoot
            style={{
                background: theme.background,
                color: theme.text,
            }}
        >
            <ToastProvider>
                <div
                    style={{
                        minHeight: "100vh",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <HeaderBar/>
                    <main style={{flex: 1, width: "100%"}}>
                        <DemoBanner visible={!isTelegram}/>
                        <div style={{paddingBottom: 24}}>
                            <AppRouter/>
                        </div>
                    </main>
                    <FooterBar/>
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
                <TMAProvider>
                            <AppContent/>
                </TMAProvider>
        </BrowserRouter>
    );
}
