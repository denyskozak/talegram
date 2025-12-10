import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Category } from '../types/backend';
import './BookForm.css';

type BookFormData = {
  id: string;
  title: string;
  authors: string[];
  categories: string;
  coverUrl: string;
  description: string;
  price: number;
  rating: {
    average: number;
    votes: number;
  };
  tags: string[];
  publishedAt?: string;
  reviewsCount: number;
};

type Props = {
  initialValues: BookFormData;
  categories: Category[];
  submitLabel: string;
  allowIdEdit?: boolean;
  onSubmit: (values: BookFormData) => Promise<void> | void;
  onCancel?: () => void;
};

type DraftState = {
  id: string;
  title: string;
  authors: string;
  selectedCategory: string;
  coverUrl: string;
  description: string;
  price: string;
  ratingAverage: string;
  ratingVotes: string;
  tags: string;
  publishedAt: string;
  reviewsCount: string;
};

function toDraft(values: BookFormData): DraftState {
  return {
    id: values.id,
    title: values.title,
    authors: values.authors.join(', '),
    selectedCategory: values.categories ?? '',
    coverUrl: values.coverUrl,
    description: values.description,
    price: values.price.toString(10),
    ratingAverage: values.rating.average.toString(10),
    ratingVotes: values.rating.votes.toString(10),
    tags: values.tags.join(', '),
    publishedAt: values.publishedAt ? values.publishedAt.slice(0, 10) : '',
    reviewsCount: values.reviewsCount.toString(10),
  };
}

function parseNumber(value: string, fallback: number, clamp?: [number, number]): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (clamp) {
    return Math.min(Math.max(parsed, clamp[0]), clamp[1]);
  }

  return parsed;
}

function normalizeList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function BookForm({
  initialValues,
  categories,
  submitLabel,
  allowIdEdit = false,
  onSubmit,
  onCancel,
}: Props): JSX.Element {
  const [draft, setDraft] = useState<DraftState>(() => toDraft(initialValues));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDraft(toDraft(initialValues));
  }, [initialValues]);

  const categoryOptions = useMemo(
    () => [...categories].sort((a, b) => a.title.localeCompare(b.title)),
    [categories],
  );

  const handleCategoryChange = (categoryId: string) => {
    setDraft((current) => {
      const next = current.selectedCategory === categoryId ? '' : categoryId;
      return { ...current, selectedCategory: next };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const id = draft.id.trim();
    const title = draft.title.trim();
    const authors = normalizeList(draft.authors);
    const categoryId = draft.selectedCategory.trim();
    const coverUrl = draft.coverUrl.trim();
    const description = draft.description.trim();
    const tags = normalizeList(draft.tags);
    const price = parseNumber(draft.price, initialValues.price, [0, 10]);
    const ratingAverage = parseNumber(draft.ratingAverage, initialValues.rating.average, [0, 5]);
    const ratingVotes = Math.max(0, Math.round(parseNumber(draft.ratingVotes, initialValues.rating.votes)));
    const reviewsCount = Math.max(0, Math.round(parseNumber(draft.reviewsCount, initialValues.reviewsCount)));

    if (!id) {
      setSubmitError('ID is required.');
      return;
    }

    if (!title) {
      setSubmitError('Title is required.');
      return;
    }

    if (authors.length === 0) {
      setSubmitError('Please add at least one author.');
      return;
    }

    if (!categoryId) {
      setSubmitError('Select a category.');
      return;
    }

    // if (!coverUrl) {
    //   setSubmitError('Cover URL is required.');
    //   return;
    // }

    if (!description) {
      setSubmitError('Description is required.');
      return;
    }

    const publishedAt = draft.publishedAt
      ? new Date(draft.publishedAt).toISOString()
      : undefined;

    const payload: BookFormData = {
      id,
      title,
      authors,
      categories: categoryId,
      coverUrl,
      description,
      price: Math.round(price),
      rating: {
        average: Number(ratingAverage.toFixed(2)),
        votes: ratingVotes,
      },
      tags,
      publishedAt,
      reviewsCount,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (error) {
      console.error('Failed to submit book form', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="book-form" onSubmit={handleSubmit}>
      <div className="book-form__grid">
        <label>
          <span>ID</span>
          <input
            type="text"
            value={draft.id}
            onChange={(event) => setDraft((state) => ({ ...state, id: event.target.value }))}
            disabled={!allowIdEdit}
          />
        </label>
        <label>
          <span>Title</span>
          <input
            type="text"
            value={draft.title}
            onChange={(event) => setDraft((state) => ({ ...state, title: event.target.value }))}
          />
        </label>
        <label>
          <span>Authors</span>
          <input
            type="text"
            value={draft.authors}
            onChange={(event) => setDraft((state) => ({ ...state, authors: event.target.value }))}
            placeholder="Separated by comma"
          />
        </label>
        <label>
          <span>Cover URL</span>
          <input
            type="url"
            value={draft.coverUrl}
            onChange={(event) => setDraft((state) => ({ ...state, coverUrl: event.target.value }))}
          />
        </label>
        <label className="book-form__description">
          <span>Description</span>
          <textarea
            value={draft.description}
            onChange={(event) => setDraft((state) => ({ ...state, description: event.target.value }))}
            rows={5}
          />
        </label>
      </div>

      <fieldset className="book-form__categories">
        <legend>Categories</legend>
        <div className="book-form__chips">
          {categoryOptions.map((category) => {
            const checked = draft.selectedCategory === category.id;
            return (
              <label key={category.id} className={checked ? 'chip chip--active' : 'chip'}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleCategoryChange(category.id)}
                />
                {category.title}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="book-form__grid">
        <label>
          <span>Price stars</span>
          <input
            type="number"
            min={0}
            max={10}
            value={draft.price}
            onChange={(event) => setDraft((state) => ({ ...state, price: event.target.value }))}
          />
        </label>
        <label>
          <span>Average rating</span>
          <input
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={draft.ratingAverage}
            onChange={(event) => setDraft((state) => ({ ...state, ratingAverage: event.target.value }))}
          />
        </label>
        <label>
          <span>Rating votes</span>
          <input
            type="number"
            min={0}
            value={draft.ratingVotes}
            onChange={(event) => setDraft((state) => ({ ...state, ratingVotes: event.target.value }))}
          />
        </label>
        <label>
          <span>Tags</span>
          <input
            type="text"
            value={draft.tags}
            onChange={(event) => setDraft((state) => ({ ...state, tags: event.target.value }))}
            placeholder="Separated by comma"
          />
        </label>
        <label>
          <span>Published date</span>
          <input
            type="date"
            value={draft.publishedAt}
            onChange={(event) => setDraft((state) => ({ ...state, publishedAt: event.target.value }))}
          />
        </label>
        <label>
          <span>Reviews count</span>
          <input
            type="number"
            min={0}
            value={draft.reviewsCount}
            onChange={(event) => setDraft((state) => ({ ...state, reviewsCount: event.target.value }))}
          />
        </label>
      </div>

      {submitError ? <div className="book-form__error">{submitError}</div> : null}

      <div className="book-form__actions">
        {onCancel ? (
          <button type="button" className="book-form__secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="book-form__primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export type { BookFormData };
