import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enTranslation from "./locales/en/translation.json";
import ruTranslation from "./locales/ru/translation.json";
import ukTranslation from "./locales/uk/translation.json";

const STORAGE_KEY = "open-reader-language";
const FALLBACK_LANGUAGE = "en" as const;
const SUPPORTED_LANGUAGES = ["en", "ru", "uk"] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type Resources = {
  [key in SupportedLanguage]: {
    translation: Record<string, unknown>;
  };
};

const resources: Resources = {
  en: { translation: enTranslation },
  ru: { translation: ruTranslation },
  uk: { translation: ukTranslation },
};

function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window === "undefined") {
    return FALLBACK_LANGUAGE;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
    return stored as SupportedLanguage;
  }

  const telegramLanguage =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (typeof telegramLanguage === "string") {
    const normalized = telegramLanguage.slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
      return normalized as SupportedLanguage;
    }
  }

  const browserLanguage = typeof navigator !== "undefined" ? navigator.language : undefined;
  if (browserLanguage) {
    const normalized = browserLanguage.slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGES.includes(normalized as SupportedLanguage)) {
      return normalized as SupportedLanguage;
    }
  }

  return FALLBACK_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
});

if (typeof window !== "undefined") {
  i18n.on("languageChanged", (lng: string) => {
    if (SUPPORTED_LANGUAGES.includes(lng as SupportedLanguage)) {
      window.localStorage.setItem(STORAGE_KEY, lng);
    }
  });
}

export { SUPPORTED_LANGUAGES };
export default i18n;
