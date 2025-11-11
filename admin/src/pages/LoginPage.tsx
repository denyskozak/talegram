import { FormEvent, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTrpc } from '../api/trpcProvider.js';
import './LoginPage.css';

type LocationState = {
  from?: Location;
};

export function LoginPage(): JSX.Element {
  const { client, setSecret } = useTrpc();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | undefined;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.trim().length === 0) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      await client.admin.login.mutate({ password });
      setSecret(password);
      const next = state?.from?.pathname ?? '/books';
      navigate(next, { replace: true });
    } catch (err) {
      console.error('Failed to login', err);
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form className="login__form" onSubmit={handleSubmit}>
        <h1 className="login__title">Admin console</h1>
        <label className="login__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter admin password"
            autoFocus
          />
        </label>
        {error ? <div className="login__error">{error}</div> : null}
        <button type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
