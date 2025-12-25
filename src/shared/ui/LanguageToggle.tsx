import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/Button";

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "EN",
  ru: "RU",
  uk: "UK",
};

export function LanguageToggle(): JSX.Element {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.language;
  const normalizedLanguage = currentLanguage.slice(0, 2).toLowerCase();

  const availableLanguages = SUPPORTED_LANGUAGES;
  const activeLanguage = availableLanguages.includes(normalizedLanguage as SupportedLanguage)
    ? (normalizedLanguage as SupportedLanguage)
    : availableLanguages[0];

  const buildAriaLabel = useMemo(
    () => (language: SupportedLanguage) => {
      const languageNameKey = `languages.${language}`;
      return t("header.languageToggle", { language: t(languageNameKey) });
    },
    [t],
  );

  const handleChangeLanguage = (language: SupportedLanguage) => {
    if (language !== activeLanguage) {
      void i18n.changeLanguage(language);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {availableLanguages.map((language) => {
        const label = LANGUAGE_LABELS[language] ?? language.toUpperCase();
        const isActive = language === activeLanguage;

        return (
          <Button
            key={language}
            size="s"
            mode={isActive ? "filled" : "outline"}
            onClick={() => handleChangeLanguage(language)}
            aria-label={buildAriaLabel(language)}
            style={{ minWidth: 44 }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
