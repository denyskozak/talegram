import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../backend/src/index.js';

type TrpcContextValue = {
  client: TRPCClient<AppRouter>;
  token: string | null;
  setToken: (token: string | null) => void;
};

const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const STORAGE_KEY = 'talegram-admin-token';

function resolveBackendUrl(): string {
  const rawUrl = import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return DEFAULT_BACKEND_URL;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const backendUrl = resolveBackendUrl();

function createClient(token: string | null): TRPCClient<AppRouter> {
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
  const [token, setTokenState] = useState<string | null>(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  });

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const client = useMemo(() => createClient(token), [token]);

  const value = useMemo<TrpcContextValue>(
    () => ({ client, token, setToken }),
    [client, token, setToken],
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
