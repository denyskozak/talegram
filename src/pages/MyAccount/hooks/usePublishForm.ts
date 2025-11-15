import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import type { TFunction } from "i18next";

import { isGlobalCategory } from "@/shared/constants/globalCategories";

import { HASHTAG_MAX_LENGTH, MAX_HASHTAGS } from "../constants";
import type { PublishFormState } from "../types";

const createInitialFormState = (): PublishFormState => ({
  title: "",
  author: "",
  description: "",
  globalCategory: "",
  category: "",
  price: "",
  isFree: false,
  hashtags: [],
  hashtagsInput: "",
  fileName: "",
  file: null,
  coverFileName: "",
  coverFile: null,
});

export type UsePublishFormParams = {
  showToast: (message: string) => void;
  t: TFunction<"translation">;
};

export type UsePublishFormResult = {
  formState: PublishFormState;
  fileInputRef: RefObject<HTMLInputElement>;
  coverInputRef: RefObject<HTMLInputElement>;
  handleInputChange: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  handleFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCoverSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  handleHashtagAdd: (value: string) => void;
  handleHashtagRemove: (tag: string) => void;
  handleHashtagKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  collectSubmissionHashtags: (state: PublishFormState) => string[];
  resetForm: () => void;
};

export function usePublishForm({ showToast, t }: UsePublishFormParams): UsePublishFormResult {
  const [formState, setFormState] = useState<PublishFormState>(() => createInitialFormState());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const sanitizeHashtag = useCallback((rawValue: string): string | null => {
    if (typeof rawValue !== "string") {
      return null;
    }

    const trimmed = rawValue.replace(/^#+/, "").trim();
    if (trimmed.length === 0) {
      return null;
    }

    return trimmed.slice(0, HASHTAG_MAX_LENGTH);
  }, []);

  const collectSubmissionHashtags = useCallback(
    (state: PublishFormState): string[] => {
      const normalized = new Map<string, string>();

      for (const tag of state.hashtags) {
        const sanitized = sanitizeHashtag(tag);
        if (!sanitized) {
          continue;
        }

        const key = sanitized.toLowerCase();
        if (!normalized.has(key) && normalized.size < MAX_HASHTAGS) {
          normalized.set(key, sanitized);
        }
      }

      if (state.hashtagsInput) {
        const sanitized = sanitizeHashtag(state.hashtagsInput);
        if (sanitized) {
          const key = sanitized.toLowerCase();
          if (!normalized.has(key) && normalized.size < MAX_HASHTAGS) {
            normalized.set(key, sanitized);
          }
        }
      }

      return Array.from(normalized.values());
    },
    [sanitizeHashtag],
  );

  const handleHashtagAdd = useCallback(
    (rawValue: string) => {
      const sanitized = sanitizeHashtag(rawValue);
      if (!sanitized) {
        showToast(t("account.publish.toastHashtagInvalid"));
        return;
      }

      let limitReached = false;
      setFormState((prev) => {
        if (prev.hashtags.length >= MAX_HASHTAGS) {
          limitReached = true;
          return prev.hashtagsInput.length > 0 ? { ...prev, hashtagsInput: "" } : prev;
        }

        const exists = prev.hashtags.some((tag) => tag.toLowerCase() === sanitized.toLowerCase());
        if (exists) {
          return { ...prev, hashtagsInput: "" };
        }

        return {
          ...prev,
          hashtags: [...prev.hashtags, sanitized],
          hashtagsInput: "",
        };
      });

      if (limitReached) {
        showToast(t("account.publish.toastHashtagLimit", { count: MAX_HASHTAGS }));
      }
    },
    [sanitizeHashtag, showToast, t],
  );

  const handleHashtagKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        handleHashtagAdd(event.currentTarget.value);
      }
    },
    [handleHashtagAdd],
  );

  const handleHashtagRemove = useCallback((tagToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      hashtags: prev.hashtags.filter((tag) => tag !== tagToRemove),
    }));
  }, []);

  const handleInputChange = useCallback(
    (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
      const { name } = event.target;

      if (event.target instanceof HTMLInputElement && event.target.type === "checkbox") {
        const { checked } = event.target;
        setFormState((prev) => ({
          ...prev,
          [name]: checked,
          ...(name === "isFree" && checked ? { price: "" } : {}),
        }));
        return;
      }

      const value = event.target.value;

      if (name === "globalCategory") {
        setFormState((prev) => ({
          ...prev,
          globalCategory: isGlobalCategory(value) ? value : "",
          category: "",
        }));
        return;
      }

      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleFileSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFormState((prev) => ({
      ...prev,
      fileName: file ? file.name : "",
      file,
    }));
  }, []);

  const handleCoverSelect = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setFormState((prev) => ({
      ...prev,
      coverFileName: file ? file.name : "",
      coverFile: file,
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(createInitialFormState());
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (coverInputRef.current) {
      coverInputRef.current.value = "";
    }
  }, []);

  return {
    formState,
    fileInputRef,
    coverInputRef,
    handleInputChange,
    handleFileSelect,
    handleCoverSelect,
    handleHashtagAdd,
    handleHashtagRemove,
    handleHashtagKeyDown,
    collectSubmissionHashtags,
    resetForm,
  };
}
