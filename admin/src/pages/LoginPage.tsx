import { FormEvent, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTrpc } from '../api/trpcProvider.js';
import './LoginPage.css';

type LocationState = {
  from?: Location;
};

export function LoginPage(): JSX.Element {
  const { client, setToken } = useTrpc();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | undefined;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (username.trim().length === 0 || password.trim().length === 0) {
      setError('Username and password are required');
      return;
    }

    setLoading(true);
    try {
      const result = await client.admin.login.mutate({ username, password });
      setToken(result.token);
      const next = state?.from?.pathname ?? '/books';
      navigate(next, { replace: true });
    } catch (err) {
      console.error('Failed to login', err);
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form className="login__form" onSubmit={handleSubmit}>
        <h1 className="login__title">Admin console</h1>
        <label className="login__field">
          <span>Username</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter admin username"
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="login__field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter admin password"
            autoComplete="current-password"
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
