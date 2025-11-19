import { Card, Select, Text, Title } from "@telegram-apps/telegram-ui";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";
import { GLOBAL_CATEGORIES, isGlobalCategory, type GlobalCategory } from "@/shared/lib/globalCategories";
import { Button } from "@/shared/ui/Button";

import { HASHTAG_MAX_LENGTH, MAX_HASHTAGS } from "../constants";
import type { PublishFormState } from "../types";
import { QuoteCarouselNotice } from "./QuoteCarouselNotice";

const CATEGORY_OPTIONS_BY_GLOBAL: Record<GlobalCategory, Array<{ value: string; label: string }>> = {
  book: [
    { value: "Science Fiction", label: "Science Fiction" },
    { value: "Fantasy", label: "Fantasy" },
    { value: "Mystery & Thrillers", label: "Mystery & Thrillers" },
    { value: "Novels / Literary Fiction", label: "Novels / Literary Fiction" },
    { value: "Non-Fiction", label: "Non-Fiction" },
    { value: "Self-Help & Psychology", label: "Self-Help & Psychology" },
    { value: "History", label: "History" },
    { value: "Biographies & Memoirs", label: "Biographies & Memoirs" },
    { value: "Business & Finance", label: "Business & Finance" },
    { value: "Children’s Literature", label: "Children’s Literature" },
  ],
  article: [
    { value: "News & Politics", label: "News & Politics" },
    { value: "Science & Technology", label: "Science & Technology" },
    { value: "Business & Economics", label: "Business & Economics" },
    { value: "Education", label: "Education" },
    { value: "Sports", label: "Sports" },
    { value: "Entertainment (movies, music, showbiz)", label: "Entertainment (movies, music, showbiz)" },
    { value: "Travel", label: "Travel" },
    { value: "Lifestyle", label: "Lifestyle" },
    { value: "Health & Medicine", label: "Health & Medicine" },
    { value: "Culture & Arts", label: "Culture & Arts" },
  ],
  comics: [
    { value: "Superheroes", label: "Superheroes" },
    { value: "Manga", label: "Manga" },
    { value: "Fantasy", label: "Fantasy" },
    { value: "Science Fiction", label: "Science Fiction" },
    { value: "Horror", label: "Horror" },
    { value: "Adventure", label: "Adventure" },
    { value: "Comedy / Satire", label: "Comedy / Satire" },
    { value: "Crime / Noir", label: "Crime / Noir" },
    { value: "Romance", label: "Romance" },
    { value: "Historical Comics", label: "Historical Comics" },
  ],
};

export type PublishSectionProps = {
  formState: PublishFormState;
  theme: ThemeColors;
  t: TFunction<"translation">;
  isSubmitting: boolean;
  canSubmit: boolean;
  isAuthorsLoading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  coverInputRef: RefObject<HTMLInputElement>;
  audiobookInputRef: RefObject<HTMLInputElement>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInputChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onCoverSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onAudiobookSelect: (event: ChangeEvent<HTMLInputElement>) => void;
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
  audiobookInputRef,
  onSubmit,
  onInputChange,
  onFileSelect,
  onCoverSelect,
  onAudiobookSelect,
  onHashtagAdd,
  onHashtagRemove,
  onHashtagKeyDown,
}: PublishSectionProps): JSX.Element {
  const isFormDisabled = isAuthorsLoading || !canSubmit;
  const isGlobalCategorySelected = isGlobalCategory(formState.globalCategory);
  let categoryOptions: Array<{ value: string; label: string }> = [];
  if (isGlobalCategory(formState.globalCategory)) {
    categoryOptions = CATEGORY_OPTIONS_BY_GLOBAL[formState.globalCategory];
  }

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
            <Text weight="2">{t("account.publish.form.globalCategory.label")}</Text>
            <Select
              required
              name="globalCategory"
              value={formState.globalCategory}
              onChange={onInputChange}
              disabled={isFormDisabled}
            >
              <option value="" disabled>
                {t("account.publish.form.globalCategory.placeholder")}
              </option>
              {GLOBAL_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {t(`globalCategories.${option}`)}
                </option>
              ))}
            </Select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.category.label")}</Text>
            <Select
              required
              name="category"
              value={formState.category}
              onChange={onInputChange}
              disabled={isFormDisabled || !isGlobalCategorySelected}
            >
              <option value="" disabled>
                {t("account.publish.form.category.placeholder")}
              </option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                name="isFree"
                checked={formState.isFree}
                onChange={onInputChange}
                disabled={isFormDisabled}
                style={{ width: 18, height: 18 }}
              />
              <Text weight="2">{t("account.publish.form.free.label")}</Text>
            </label>
            {formState.isFree ? (
              <Text style={{ color: theme.hint }}>
                {t("account.publish.form.free.hint")}
              </Text>
            ) : (
              <>
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
                </label>
                <Text style={{ color: theme.hint }}>
                  {t("account.publish.form.price.hint")}
                </Text>
              </>
            )}
          </div>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text weight="2">{t("account.publish.form.audiobook.label")}</Text>
              <Text style={{ color: theme.hint, fontSize: 12 }}>
                {t("account.publish.form.audiobook.hint")}
              </Text>
            </div>
            <input
              ref={audiobookInputRef}
              type="file"
              accept="audio/*"
              onChange={onAudiobookSelect}
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
                  audiobookInputRef.current?.click();
                }}
                disabled={isFormDisabled}
              >
                {t("account.publish.form.audiobook.cta")}
              </Button>
              <Text style={{ color: theme.subtitle }}>
                {formState.audiobookFileName || t("account.publish.form.audiobook.placeholder")}
              </Text>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Text weight="2">{t("account.publish.form.file.label")}</Text>
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
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
        {isSubmitting ? (
          <QuoteCarouselNotice theme={theme} t={t} />
        ) : (
          <Text style={{ color: theme.hint }}>{t("account.publish.form.notice")}</Text>
        )}
      </Card>
    </section>
  );
}
