import { FormEvent, useMemo, useState } from 'react';
import { useTrpc, normalizeBackendUrl } from '../api/trpcProvider.js';
import './SettingsPage.css';

type Feedback =
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | null;

export function SettingsPage(): JSX.Element {
  const { backendUrl, setBackendUrl, defaultBackendUrl, token, setToken } = useTrpc();
  const [inputValue, setInputValue] = useState(backendUrl);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const isCustomBackendUrl = useMemo(() => backendUrl !== defaultBackendUrl, [backendUrl, defaultBackendUrl]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const normalized = normalizeBackendUrl(inputValue);
    if (!normalized) {
      setFeedback({ type: 'error', message: 'Enter a valid HTTP(S) URL pointing to the backend API.' });
      return;
    }

    setBackendUrl(normalized);
    setInputValue(normalized);
    setFeedback({ type: 'success', message: 'Backend URL updated. Admin session was reset.' });
  };

  const handleReset = () => {
    setBackendUrl(defaultBackendUrl);
    setInputValue(defaultBackendUrl);
    setFeedback({ type: 'success', message: 'Backend URL reset to default value.' });
  };

  const handleClearSession = () => {
    setToken(null);
    setFeedback({ type: 'success', message: 'Admin session cleared. Please sign in again.' });
  };

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>Project settings</h1>
          <p>Configure how the admin console connects to the Talegram backend.</p>
        </div>
      </header>

      <section className="settings__card">
        <h2>Backend connection</h2>
        <p className="settings__description">
          Update the API endpoint used for all tRPC requests. Use the `/api` endpoint of your running backend instance.
        </p>
        <form className="settings__form" onSubmit={handleSubmit} noValidate>
          <label className="settings__field">
            <span>Backend URL</span>
            <input
              type="url"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="https://example.com/api"
              spellCheck={false}
              required
            />
            <span className="settings__hint">Current: {backendUrl}</span>
          </label>

          {feedback && feedback.type === 'error' ? (
            <div className="settings__feedback settings__feedback--error">{feedback.message}</div>
          ) : null}
          {feedback && feedback.type === 'success' ? (
            <div className="settings__feedback settings__feedback--success">{feedback.message}</div>
          ) : null}

          <div className="settings__actions">
            <button type="button" className="settings__secondary" onClick={handleReset} disabled={!isCustomBackendUrl}>
              Reset to default
            </button>
            <button type="submit" className="settings__primary">
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className="settings__card">
        <h2>Admin session</h2>
        <p className="settings__description">
          {token ? 'An admin session is currently active in this browser.' : 'No admin session is currently active.'}
        </p>
        <div className="settings__actions">
          <button type="button" className="settings__secondary" onClick={handleClearSession} disabled={!token}>
            Clear session
          </button>
        </div>
      </section>

    </div>
  );
}

