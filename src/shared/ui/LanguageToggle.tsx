import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/Button";

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

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

  const nextLanguage = availableLanguages[(availableLanguages.indexOf(activeLanguage) + 1) % availableLanguages.length];

  const label = LANGUAGE_LABELS[nextLanguage] ?? nextLanguage.toUpperCase();

  const ariaLabel = useMemo(() => {
    const languageNameKey = `languages.${activeLanguage}`;
    return t("header.languageToggle", { language: t(languageNameKey) });
  }, [activeLanguage, t]);

  const handleToggle = () => {
    void i18n.changeLanguage(nextLanguage);
  };

  return (
    <Button
      size="s"
      mode="plain"
      onClick={handleToggle}
      aria-label={ariaLabel}
      style={{ minWidth: 44 }}
    >
      {label}
    </Button>
  );
}
