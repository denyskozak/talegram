import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book, Category } from '../types/backend';
import { useTrpc } from '../api/trpcProvider.js';
import './BookListPage.css';

type CategoryMap = Record<string, string>;

type RequestState = 'idle' | 'loading' | 'error';

export function BookListPage(): JSX.Element {
  const { client } = useTrpc();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<CategoryMap>({});
  const [state, setState] = useState<RequestState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState('loading');
      setError(null);
      try {
        const [booksResponseRaw, categoriesResponseRaw] = await Promise.all([
          client.admin.listBooks.query(),
          client.catalog.listCategories.query(),
        ]);

        const booksResponse = booksResponseRaw as Book[];
        const categoriesResponse = categoriesResponseRaw as Category[];

        if (cancelled) {
          return;
        }

        const categoryMap = categoriesResponse.reduce<CategoryMap>((acc, category: Category) => {
          acc[category.id] = category.title;
          return acc;
        }, {} as CategoryMap);

        setBooks(booksResponse);
        setCategories(categoryMap);
        setState('idle');
      } catch (err) {
        console.error('Failed to load books', err);
        if (!cancelled) {
          setError('Failed to load books. Please try again later.');
          setState('error');
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const isLoading = state === 'loading';

  const rows = useMemo(() => {
    return books.map((book) => ({
      ...book,
      categoryLabels: book.categories ? categories[book.categories] ?? book.categories : '—',
      authorLabels: book.authors.join(', '),
      tagLabels: book.tags.join(', '),
    }));
  }, [books, categories]);

  const handleDelete = async (book: Book) => {
    const confirmed = window.confirm(`Delete “${book.title}”? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await client.admin.deleteBook.mutate({ id: book.id });
      setBooks((prev) => prev.filter((item) => item.id !== book.id));
    } catch (err) {
      console.error('Failed to delete book', err);
      setError('Failed to delete book. Please try again.');
    }
  };

  return (
    <div className="book-list">
      <header className="book-list__header">
        <div>
          <h1>Books</h1>
          <p>Manage catalogue metadata, tags and availability.</p>
        </div>
        <Link to="/books/new" className="book-list__new">
          + New book
        </Link>
      </header>

      {error ? <div className="book-list__error">{error}</div> : null}

      {isLoading ? (
        <div className="book-list__empty">Loading books…</div>
      ) : rows.length === 0 ? (
        <div className="book-list__empty">No books yet. Create the first entry.</div>
      ) : (
        <div className="book-list__table-wrapper">
          <table className="book-list__table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Authors</th>
                <th>Categories</th>
                <th>Rating</th>
                <th>Price ⭐</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((book) => (
                <tr key={book.id}>
                  <td>
                    <div className="book-list__title">{book.title}</div>
                    <div className="book-list__meta">ID: {book.id}</div>
                  </td>
                  <td>{book.authorLabels}</td>
                  <td>{book.categoryLabels}</td>
                  <td>
                    <strong>{book.rating.average.toFixed(1)}</strong>
                    <span className="book-list__meta">/{book.rating.votes} votes</span>
                  </td>
                  <td>{book.priceStars}</td>
                  <td>{book.tagLabels || '—'}</td>
                  <td className="book-list__actions">
                    <Link to={`/books/${book.id}/edit`}>Edit</Link>
                    <button type="button" onClick={() => handleDelete(book)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
