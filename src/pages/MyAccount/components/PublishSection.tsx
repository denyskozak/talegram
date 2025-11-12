import { Button, Card, Text, Title } from "@telegram-apps/telegram-ui";
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  RefObject,
} from "react";
import type { TFunction } from "i18next";

import type { ThemeColors } from "@/app/providers/ThemeProvider";

import { HASHTAG_MAX_LENGTH, MAX_HASHTAGS } from "../constants";
import type { PublishFormState } from "../types";

export type PublishSectionProps = {
  formState: PublishFormState;
  theme: ThemeColors;
  t: TFunction<"translation">;
  isSubmitting: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  coverInputRef: RefObject<HTMLInputElement>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onInputChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
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
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title level="2" weight="2">
          {t("account.publish.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.publish.description")}</Text>
      </div>
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
            <input
              required
              name="category"
              value={formState.category}
              onChange={onInputChange}
              placeholder={t("account.publish.form.category.placeholder")}
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
                onClick={() => onHashtagAdd(formState.hashtagsInput)}
                disabled={formState.hashtagsInput.trim().length === 0}
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
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Button
                type="button"
                mode="outline"
                size="s"
                onClick={() => coverInputRef.current?.click()}
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
              style={{ display: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Button type="button" mode="outline" size="s" onClick={() => fileInputRef.current?.click()}>
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
            disabled={!formState.file || !formState.coverFile}
          >
            {t("account.publish.form.submit")}
          </Button>
        </form>
        <Text style={{ color: theme.hint }}>{t("account.publish.form.notice")}</Text>
      </Card>
    </section>
  );
}
