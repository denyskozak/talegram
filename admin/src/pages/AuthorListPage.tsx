import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTrpc } from '../api/trpcProvider.js';
import './AuthorListPage.css';

type Author = {
  id: string;
  name: string;
  telegramUsername: string;
};

type RequestState = 'idle' | 'loading' | 'error';

type FormState = 'idle' | 'submitting';

export function AuthorListPage(): JSX.Element {
  const { client } = useTrpc();
  const [authors, setAuthors] = useState<Author[]>([]);
  const [state, setState] = useState<RequestState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAuthors() {
      setState('loading');
      setError(null);
      try {
        const response = await client.admin.listAuthors.query();
        if (cancelled) {
          return;
        }
        setAuthors(response);
        setState('idle');
      } catch (err) {
        console.error('Failed to load authors', err);
        if (!cancelled) {
          setError('Failed to load authors. Please try again later.');
          setState('error');
        }
      }
    }

    loadAuthors();

    return () => {
      cancelled = true;
    };
  }, [client]);

  const isLoading = state === 'loading';

  const sortedAuthors = useMemo(() => {
    return [...authors].sort((a, b) => a.name.localeCompare(b.name));
  }, [authors]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName || !trimmedUsername) {
      setFormError('Both name and Telegram username are required.');
      return;
    }

    setFormState('submitting');
    try {
      const created = await client.admin.createAuthor.mutate({
        name: trimmedName,
        telegramUsername: trimmedUsername,
      });
      setAuthors((prev) => [...prev, created]);
      setName('');
      setUsername('');
    } catch (err) {
      console.error('Failed to create author', err);
      setFormError('Failed to create author. Please verify the data and try again.');
    } finally {
      setFormState('idle');
    }
  };

  return (
    <div className="author-list">
      <header className="author-list__header">
        <div>
          <h1>Authors</h1>
          <p>Manage author directory and Telegram usernames.</p>
        </div>
      </header>

      <section className="author-list__create">
        <h2>Add new author</h2>
        <form className="author-list__form" onSubmit={handleSubmit}>
          <label className="author-list__field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jane Doe"
              required
            />
          </label>
          <label className="author-list__field">
            <span>Telegram username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@janedoe"
              required
            />
          </label>
          {formError ? <div className="author-list__error">{formError}</div> : null}
          <button type="submit" disabled={formState === 'submitting'}>
            {formState === 'submitting' ? 'Saving…' : 'Add author'}
          </button>
        </form>
      </section>

      <section className="author-list__table-section">
        <h2>Existing authors</h2>
        {error ? <div className="author-list__error">{error}</div> : null}

        {isLoading ? (
          <div className="author-list__empty">Loading authors…</div>
        ) : sortedAuthors.length === 0 ? (
          <div className="author-list__empty">No authors yet. Add the first one above.</div>
        ) : (
          <div className="author-list__table-wrapper">
            <table className="author-list__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Telegram</th>
                </tr>
              </thead>
              <tbody>
                {sortedAuthors.map((author) => (
                  <tr key={author.id}>
                    <td>
                      <div className="author-list__name">{author.name}</div>
                      <div className="author-list__meta">ID: {author.id}</div>
                    </td>
                    <td>
                      <span className="author-list__username">{author.telegramUsername}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
