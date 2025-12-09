import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {Avatar, Card, Section, Select, Text, Title} from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { useTMA } from "@/app/providers/TMAProvider";
import type { CatalogApi, ID, Review } from "@/entities/book/types";
import { formatRating } from "@/shared/lib/rating";
import { useToast } from "@/shared/ui/ToastProvider";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorBanner } from "@/shared/ui/ErrorBanner";
import { ReviewSkeleton } from "@/shared/ui/Skeletons";
import { Button } from "@/shared/ui/Button";

interface ReviewsListProps {
  api: CatalogApi;
  bookId: ID;
  onReviewCreated?: (review: Review) => void;
}

/**
 * Review text commented in code
 */
export function ReviewsList({ api, bookId, onReviewCreated }: ReviewsListProps): JSX.Element {
  const [items, setItems] = useState<Review[]>([]);
  const [cursorState, setCursorState] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, i18n } = useTranslation();
  const { launchParams } = useTMA();
  const { showToast } = useToast();
  const cursorRef = useRef<string | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasMore = useMemo(() => Boolean(cursorState), [cursorState]);

  const defaultAuthorName = useMemo(() => {
      console.log("launchParams: ", launchParams);
    const user = launchParams?.tgWebAppData?.user;
    const username = user?.username?.trim();

    if (username) {
      return username;
    }

    return t("reviews.form.defaultName");
  }, [launchParams, t]);

  const authorImage = useMemo(() => {
    return launchParams?.tgWebAppData?.user?.photo_url ?? '';
  }, [launchParams]);

  useEffect(() => {
    setAuthorName((current) => (current.trim().length > 0 ? current : defaultAuthorName));
  }, [defaultAuthorName]);

  const updateCursor = useCallback((nextCursor: string | undefined) => {
    cursorRef.current = nextCursor;
    setCursorState(nextCursor);
  }, []);

  const load = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset === true;
      try {
        setIsLoading(true);
        setError(null);
        if (reset) {
          setItems([]);
          updateCursor(undefined);
        }
        const response = await api.listReviews(bookId, reset ? undefined : cursorRef.current);
        updateCursor(response.nextCursor);
        setItems((prev) => (reset ? response.items : [...prev, ...response.items]));
      } catch (err) {
        console.error(err);
        setError(t("errors.loadReviews"));
      } finally {
        setIsLoading(false);
      }
    },
    [api, bookId, t, updateCursor],
  );

  useEffect(() => {
    setItems([]);
    setError(null);
    setIsFormOpen(false);
    setText("");
    setRating(5);
    setSubmitError(null);
    cursorRef.current = undefined;
    setCursorState(undefined);
    void load({ reset: true });
  }, [bookId, load]);

  const handleOpenForm = useCallback(() => {
    setIsFormOpen(true);
    setSubmitError(null);
    setText("");
    setRating(5);
  }, []);

  const handleCancelForm = useCallback(() => {
    setIsFormOpen(false);
    setSubmitError(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const normalizedName = authorName.trim();
      const normalizedText = text.trim();
      if (normalizedName.length === 0 || normalizedText.length === 0) {
        setSubmitError(t("reviews.form.validation"));
        return;
      }

      try {
        setIsSubmitting(true);
        setSubmitError(null);
        const createdReview = await api.createReview({
          bookId,
          authorName: normalizedName,
          rating,
          text: normalizedText,
        });
        showToast(t("reviews.toast.success"));
        setIsFormOpen(false);
        setText("");
        setRating(5);
        await load({ reset: true });
        onReviewCreated?.(createdReview);
      } catch (err) {
        console.error(err);
        setSubmitError(t("errors.submitReview"));
        showToast(t("reviews.toast.error"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, authorName, bookId, load, onReviewCreated, rating, showToast, t, text],
  );

  const isSubmitDisabled =
    isSubmitting || authorName.trim().length === 0 || rating < 1 || rating > 5;

  const locale = i18n.language.startsWith("ru") ? "ru-RU" : "en-US";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 16, borderRadius: 20 }}>
        {isFormOpen ? (

                <Section   header={t("reviews.form.title")}>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", padding: 4, flexDirection: "column", gap: 12 }}
            noValidate
          >
            {/*<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>*/}
            {/*  <Text weight="2">{t("reviews.form.nameLabel")}</Text>*/}
            {/*  <Input*/}
            {/*      className="input-wrapper"*/}
            {/*    value={authorName}*/}
            {/*      disabled*/}
            {/*    onChange={(event) => setAuthorName(event.target.value)}*/}
            {/*    placeholder={t("reviews.form.namePlaceholder")}*/}
            {/*    required*/}
            {/*  />*/}
            {/*</label>*/}
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Text weight="2">{t("reviews.form.ratingLabel")}</Text>
              <Select
                value={rating}
                onChange={(event) => setRating(Number.parseInt(event.target.value, 10))}
                disabled={isSubmitting}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {t("reviews.form.ratingOption", { value })}
                  </option>
                ))}
              </Select>
            </label>
            {/*<label style={{ display: "flex", flexDirection: "column", gap: 6 }}>*/}
            {/*  <Text weight="2">{t("reviews.form.textLabel")}</Text>*/}
            {/*  <Textarea*/}
            {/*    value={text}*/}
            {/*    onChange={(event) => setText(event.target.value)}*/}
            {/*    placeholder={t("reviews.form.textPlaceholder")}*/}
            {/*    rows={4}*/}
            {/*    disabled={isSubmitting}*/}

            {/*    required*/}
            {/*  />*/}
            {/*</label>*/}
            {submitError && (
              <Text style={{ color: "var(--tg-theme-destructive-text-color, #d84b4b)" }}>{submitError}</Text>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitDisabled}
                style={{ flex: 1 }}
              >
                {t("reviews.form.submit")}
              </Button>
              <Button type="button" mode="outline" onClick={handleCancelForm} disabled={isSubmitting}>
                {t("buttons.cancel")}
              </Button>
            </div>
          </form>
                </Section>
        ) : (
          <Button mode="outline" onClick={handleOpenForm} aria-label={t("reviews.addButton")}>
            {t("reviews.addButton")}
          </Button>
        )}
      </Card>
      {error && <ErrorBanner message={error} onRetry={() => load({ reset: true })} />}
      {!error && !isLoading && items.length === 0 && (
        <EmptyState title={t("reviews.emptyTitle")} description={t("reviews.emptyDescription")} />
      )}
      {items.map((review) => (
        <Card key={review.id} style={{ padding: 16, borderRadius: 20 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <Avatar size={40} style={{ background: "var(--tg-theme-secondary-bg-color, #f3f3f5)" }}>
              {review.authorName.charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <Title level="3" weight="2">
                {review.authorName}
              </Title>
              <Text style={{ color: "var(--tg-theme-subtitle-text-color, #7f7f81)" }}>
                {new Intl.DateTimeFormat(locale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(new Date(review.createdAt))}
                {" • "}
                {t("reviews.rating", { value: formatRating(review.rating) })}
              </Text>
              {/*<Text style={{ lineHeight: 1.4 }}>{review.text}</Text>*/}
            </div>
          </div>
        </Card>
      ))}
      {isLoading && (
        <Card style={{ padding: 16, borderRadius: 20 }}>
          <ReviewSkeleton />
        </Card>
      )}
      {hasMore && !isLoading && (
        <Button mode="outline" onClick={() => load()}>
          {t("reviews.loadMore")}
        </Button>
      )}
    </div>
  );
}
