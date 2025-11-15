import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../types/backend';

type TrpcContextValue = {
  client: ReturnType<typeof createTRPCClient<AppRouter>> | any;
  token: string | null;
  setToken: (token: string | null) => void;
  backendUrl: string;
  defaultBackendUrl: string;
  setBackendUrl: (url: string) => void;
};

const DEFAULT_BACKEND_URL = 'http://localhost:5174/api';
const STORAGE_KEY = 'talegram-admin-token';
const BACKEND_URL_STORAGE_KEY = 'talegram-admin-backend-url';

function normalizeBackendUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Ensure consistent representation without trailing slash.
    const normalized = url.href.endsWith('/') ? url.href.slice(0, -1) : url.href;
    return normalized;
  } catch (error) {
    console.error('Failed to normalize backend URL', error);
    return null;
  }
}

function resolveBackendUrl(): string {
  const normalized = normalizeBackendUrl(import.meta.env.VITE_BACKEND_URL);
  return normalized ?? DEFAULT_BACKEND_URL;
}

function createClient(backendUrl: string, token: string | null) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: backendUrl,
        headers() {
          const headers: Record<string, string> = {
            'X-Test-Env': 'true',
            'ngrok-skip-browser-warning': 'true',
          };

          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }

          return headers;
        },
      }),
    ],
  });
}

const TrpcContext = createContext<TrpcContextValue | undefined>(undefined);

export function TrpcProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const defaultBackendUrl = resolveBackendUrl();
  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  });
  const [backendUrl, setBackendUrlState] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return defaultBackendUrl;
    }

    const stored = window.localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    const normalized = normalizeBackendUrl(stored);
    return normalized ?? defaultBackendUrl;
  });

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (typeof window !== 'undefined') {
      if (value) {
        window.sessionStorage.setItem(STORAGE_KEY, value);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setBackendUrl = useCallback(
    (value: string) => {
      const normalized = normalizeBackendUrl(value) ?? defaultBackendUrl;
      setBackendUrlState(normalized);

      if (typeof window !== 'undefined') {
        if (normalized === defaultBackendUrl) {
          window.localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
        } else {
          window.localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);
        }
      }

      // Reset admin session to avoid leaking credentials across environments.
      setToken(null);
    },
    [defaultBackendUrl, setToken],
  );

  const client = useMemo(() => createClient(backendUrl, token) as any, [backendUrl, token]);

  const value = useMemo<TrpcContextValue>(
    () => ({ client, token, setToken, backendUrl, setBackendUrl, defaultBackendUrl }),
    [client, token, setToken, backendUrl, setBackendUrl, defaultBackendUrl],
  );

  return <TrpcContext.Provider value={value}>{children}</TrpcContext.Provider>;
}

export function useTrpc(): TrpcContextValue {
  const context = useContext(TrpcContext);
  if (!context) {
    throw new Error('useTrpc must be used inside TrpcProvider');
  }

  return context;
}

export { DEFAULT_BACKEND_URL, normalizeBackendUrl };
