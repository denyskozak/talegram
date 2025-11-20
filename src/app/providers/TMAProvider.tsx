import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
    init as initSDK,
    isTMA,
    retrieveLaunchParams,
    retrieveRawInitData,
    setDebug,
    themeParams, useSignal,

} from "@tma.js/sdk-react";

import  {backButton} from "@tma.js/sdk";
import type {LaunchParams, BackButton, ThemeParamsState} from "@tma.js/sdk";

const DEMO_BANNER_DELAY = 150;

export type TMAContextValue = {
    backButton: BackButton;
  isTelegram: boolean;
  launchParams?: LaunchParams;
  initDataRaw?: string;
  theme?: ThemeParamsState | null;
};

const TMAContext = createContext<TMAContextValue | undefined>(undefined);

export function TMAProvider({ children }: PropsWithChildren): JSX.Element {
  const [isTelegram, setIsTelegram] = useState<boolean>(() => isTMA());
  const [launchParamsState, setLaunchParamsState] =
    useState<LaunchParams>();
  const [initData, setInitData] = useState<string>();
  const theme =  useSignal(themeParams.state, () => themeParams.state());

  useEffect(() => {
    setDebug(import.meta.env.DEV);
    initSDK();

    if (!themeParams.isMounted()) themeParams.mount();

    const timer = window.setTimeout(() => {
      setIsTelegram(isTMA());
    }, DEMO_BANNER_DELAY);

    try {
      const lp = retrieveLaunchParams();
        console.log("lp: ", lp);
      setLaunchParamsState(lp);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Unable to retrieve launch params", error);
      }
    }

    try {
      const raw = retrieveRawInitData();
      if (raw) {
        setInitData(raw);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Unable to retrieve init data", error);
      }
    }

    if (import.meta.env.DEV) {
      void import("eruda").then(({ default: eruda }) => {
        if (typeof eruda.get === "function") {
          eruda.init();
          eruda.position({ x: window.innerWidth - 50, y: 16 });
        }
      });
    }

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const value = useMemo<TMAContextValue>(
    () => ({
      isTelegram,
      launchParams: launchParamsState,
      initDataRaw: initData,
      theme,
        backButton
    }),
    [initData, isTelegram, launchParamsState, theme],
  );

  return <TMAContext.Provider value={value}>{children}</TMAContext.Provider>;
}

export function useTMA(): TMAContextValue {
  const context = useContext(TMAContext);

  if (!context) {
    throw new Error("useTMA must be used inside TMAProvider");
  }

  return context;
}
