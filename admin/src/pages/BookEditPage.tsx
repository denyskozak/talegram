import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Book, Category } from '../types/backend';
import { useTrpc } from '../api/trpcProvider.js';
import { BookForm, type BookFormData } from '../components/BookForm.js';

function toFormData(book: Book): BookFormData {
  return {
    id: book.id,
    title: book.title,
    authors: [...book.authors],
    categories: book.categories ?? '',
    coverUrl: book.coverUrl,
    description: book.description,
    priceStars: book.priceStars,
    rating: {
      average: book.rating.average,
      votes: book.rating.votes,
    },
    tags: [...book.tags],
    publishedAt: book.publishedAt,
    reviewsCount: book.reviewsCount,
  };
}

export function BookEditPage(): JSX.Element {
  const { client } = useTrpc();
  const navigate = useNavigate();
  const params = useParams<{ bookId: string }>();
  const bookId = params.bookId ?? '';
  const [categories, setCategories] = useState<Category[]>([]);
  const [initial, setInitial] = useState<BookFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setError('Book ID is missing.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [categoriesResponse, bookResponse] = await Promise.all([
          client.catalog.listCategories.query(),
          client.admin.getBook.query({ id: bookId }),
        ]);

        if (cancelled) {
          return;
        }

        setCategories((categoriesResponse ?? []) as Category[]);
        setInitial(toFormData(bookResponse as Book));
      } catch (err) {
        console.error('Failed to load book data', err);
        if (!cancelled) {
          setError('Failed to load book. It may have been removed.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [client, bookId]);

  const handleSubmit = async (values: BookFormData) => {
    try {
      await client.admin.updateBook.mutate({
        id: bookId,
        patch: {
          title: values.title,
          authors: values.authors,
          categories: values.categories,
          coverUrl: values.coverUrl,
          description: values.description,
          priceStars: values.priceStars,
          rating: values.rating,
          tags: values.tags,
          publishedAt: values.publishedAt,
          reviewsCount: values.reviewsCount,
        },
      });
      navigate('/books', { replace: true });
    } catch (err) {
      console.error('Failed to update book', err);
      const message = err instanceof Error ? err.message : 'Failed to update book.';
      throw new Error(message);
    }
  };

  if (loading) {
    return <div>Loading book…</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!initial) {
    return <div>Book not found.</div>;
  }

  return (
    <div className="page">
      <h1>Edit book</h1>
      <BookForm
        initialValues={initial}
        categories={categories}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        onCancel={() => navigate('/books')}
      />
    </div>
  );
}
