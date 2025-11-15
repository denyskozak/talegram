import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BookFormValues, Category } from '../types/catalog';
import { useTrpc } from '../api/trpcProvider.js';
import { BookForm } from '../components/BookForm.js';

const EMPTY_BOOK: BookFormValues = {
  id: '',
  title: '',
  authors: [],
  categories: '',
  coverUrl: '',
  description: '',
  priceStars: 5,
  rating: {
    average: 0,
    votes: 0,
  },
  tags: [],
  reviewsCount: 0,
};

export function BookCreatePage(): JSX.Element {
  const { client } = useTrpc();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await client.catalog.listCategories.query();
        if (!cancelled) {
          setCategories(response);
        }
      } catch (err) {
        console.error('Failed to load categories', err);
        if (!cancelled) {
          setError('Failed to load categories.');
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
  }, [client]);

  const handleSubmit = async (values: BookFormValues) => {
    try {
      await client.admin.createBook.mutate(values);
      navigate('/books', { replace: true });
    } catch (err) {
      console.error('Failed to create book', err);
      const message = err instanceof Error ? err.message : 'Failed to create book.';
      throw new Error(message);
    }
  };

  if (loading) {
    return <div>Loading categories…</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="page">
      <h1>Create book</h1>
      <BookForm
        initialValues={EMPTY_BOOK}
        categories={categories}
        submitLabel="Create"
        allowIdEdit
        onSubmit={handleSubmit}
        onCancel={() => navigate('/books')}
      />
    </div>
  );
}
