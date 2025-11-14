import { Button, Card, Select, Text, Title } from "@telegram-apps/telegram-ui";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import { HASHTAG_MAX_LENGTH, MAX_HASHTAGS } from "../constants";
import type { PublishFormState } from "../types";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "fantasy", label: "Fantasy — Фэнтези" },
  { value: "science-fiction", label: "Science Fiction — Научная фантастика" },
  { value: "mystery", label: "Mystery — Детектив" },
  { value: "romance", label: "Romance — Романтика" },
  { value: "thriller", label: "Thriller — Триллер" },
  { value: "non-fiction", label: "Non-fiction — Нон-фикшн" },
  { value: "historical", label: "Historical — Историческое" },
  { value: "self-help", label: "Self-help — Саморазвитие" },
  { value: "poetry", label: "Poetry — Поэзия" },
  { value: "young-adult", label: "Young Adult — Подростковое" },
];

export type PublishSectionProps = {
  formState: PublishFormState;
  theme: ThemeColors;
  t: TFunction<"translation">;
  isSubmitting: boolean;
  canSubmit: boolean;
  isAuthorsLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  coverInputRef: RefObject<HTMLInputElement>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInputChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onCoverSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onHashtagAdd: (value: string) => void;
  onHashtagRemove: (tag: string) => void;
  onHashtagKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function PublishSection({
  formState,
  theme,
  t,
  isSubmitting,
  canSubmit,
  isAuthorsLoading,
  fileInputRef,
  coverInputRef,
  onSubmit,
  onInputChange,
  onFileSelect,
  onCoverSelect,
  onHashtagAdd,
  onHashtagRemove,
  onHashtagKeyDown,
}: PublishSectionProps): JSX.Element {
  const isFormDisabled = isAuthorsLoading || !canSubmit;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title level="2" weight="2">
          {t("account.publish.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.publish.description")}</Text>
      </div>
      {!isAuthorsLoading && !canSubmit && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: `1px solid ${theme.separator}`,
            background: theme.section,
          }}
        >
          <Text>{t("account.publish.restrictedAlert")}</Text>
        </div>
      )}
      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.name.label")}</Text>
            <input
              required
              name="title"
              value={formState.title}
              onChange={onInputChange}
              placeholder={t("account.publish.form.name.placeholder")}
              disabled={isFormDisabled}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${theme.separator}`,
                background: theme.section,
                color: theme.text,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.author.label")}</Text>
            <input
              required
              name="author"
              value={formState.author}
              onChange={onInputChange}
              placeholder={t("account.publish.form.author.placeholder")}
              disabled={isFormDisabled}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${theme.separator}`,
                background: theme.section,
                color: theme.text,
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.category.label")}</Text>
            <Select
              required
              name="category"
              value={formState.category}
              onChange={onInputChange}
              disabled={isFormDisabled}
            >
              <option value="" disabled>
                {t("account.publish.form.category.placeholder")}
              </option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.price.label")}</Text>
            <input
              required
              type="number"
              name="price"
              value={formState.price}
              onChange={onInputChange}
              min={0}
              step={1}
              inputMode="numeric"
              placeholder={t("account.publish.form.price.placeholder")}
              disabled={isFormDisabled}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${theme.separator}`,
                background: theme.section,
                color: theme.text,
              }}
            />
            <Text style={{ color: theme.hint }}>
              {t("account.publish.form.price.hint")}
            </Text>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.hashtags.label")}</Text>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <input
                name="hashtagsInput"
                value={formState.hashtagsInput}
                onChange={onInputChange}
                onKeyDown={onHashtagKeyDown}
                placeholder={t("account.publish.form.hashtags.placeholder")}
                maxLength={HASHTAG_MAX_LENGTH + 1}
                autoComplete="off"
                disabled={isFormDisabled}
                style={{
                  flex: "1 1 220px",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1px solid ${theme.separator}`,
                  background: theme.section,
                  color: theme.text,
                  minWidth: 180,
                }}
              />
              <Button
                type="button"
                mode="outline"
                size="s"
                onClick={() => {
                  if (isFormDisabled) {
                    return;
                  }
                  onHashtagAdd(formState.hashtagsInput);
                }}
                disabled={
                  isFormDisabled || formState.hashtagsInput.trim().length === 0
                }
              >
                {t("account.publish.form.hashtags.add")}
              </Button>
            </div>
            <Text style={{ color: theme.hint }}>
              {t("account.publish.form.hashtags.hint", { count: MAX_HASHTAGS })}
            </Text>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {formState.hashtags.length === 0 ? (
                <Text style={{ color: theme.subtitle }}>
                  {t("account.publish.form.hashtags.empty")}
                </Text>
              ) : (
                formState.hashtags.map((tag) => (
                  <div
                    key={tag}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${theme.separator}`,
                      background: theme.section,
                    }}
                  >
                    <span style={{ color: theme.text }}>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => onHashtagRemove(tag)}
                      disabled={isFormDisabled}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: theme.subtitle,
                        cursor: "pointer",
                        padding: 0,
                        lineHeight: 1,
                        fontSize: 14,
                      }}
                      aria-label={t("account.publish.form.hashtags.remove", { tag })}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.description.label")}</Text>
            <textarea
              required
              name="description"
              value={formState.description}
              onChange={onInputChange}
              placeholder={t("account.publish.form.description.placeholder")}
              rows={5}
              disabled={isFormDisabled}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${theme.separator}`,
                background: theme.section,
                color: theme.text,
                resize: "vertical",
                minHeight: 120,
                font: "inherit",
              }}
            />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.cover.label")}</Text>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={onCoverSelect}
              disabled={isFormDisabled}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Button
                type="button"
                mode="outline"
                size="s"
                onClick={() => {
                  if (isFormDisabled) {
                    return;
                  }
                  coverInputRef.current?.click();
                }}
                disabled={isFormDisabled}
              >
                {t("account.publish.form.cover.cta")}
              </Button>
              <Text style={{ color: theme.subtitle }}>
                {formState.coverFileName || t("account.publish.form.cover.placeholder")}
              </Text>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.file.label")}</Text>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={onFileSelect}
              disabled={isFormDisabled}
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Button
                type="button"
                mode="outline"
                size="s"
                onClick={() => {
                  if (isFormDisabled) {
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                disabled={isFormDisabled}
              >
                {t("account.publish.form.file.cta")}
              </Button>
              <Text style={{ color: theme.subtitle }}>
                {formState.fileName || t("account.publish.form.file.placeholder")}
              </Text>
            </div>
          </div>
          <Button
            type="submit"
            mode="filled"
            size="m"
            loading={isSubmitting}
            disabled={
              isFormDisabled || !formState.file || !formState.coverFile
            }
          >
            {t("account.publish.form.submit")}
          </Button>
        </form>
        <Text style={{ color: theme.hint }}>{t("account.publish.form.notice")}</Text>
      </Card>
    </section>
  );
}
