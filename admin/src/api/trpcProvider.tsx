import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import type { AppRouter } from '../../backend/src/index.js';

type TrpcContextValue = {
  client: TRPCClient<AppRouter>;
  secret: string | null;
  setSecret: (secret: string | null) => void;
};

const DEFAULT_BACKEND_URL = 'http://localhost:3000';
const STORAGE_KEY = 'talegram-admin-secret';

function resolveBackendUrl(): string {
  const rawUrl = import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return DEFAULT_BACKEND_URL;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const backendUrl = resolveBackendUrl();

function createClient(secret: string | null): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: backendUrl,
        headers() {
          const headers: Record<string, string> = {
            'X-Test-Env': 'true',
            'ngrok-skip-browser-warning': 'true',
          };

          if (secret) {
            headers['X-Admin-Secret'] = secret;
          }

          return headers;
        },
      }),
    ],
  });
}

const TrpcContext = createContext<TrpcContextValue | undefined>(undefined);

export function TrpcProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [secret, setSecretState] = useState<string | null>(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  });

  const setSecret = useCallback((value: string | null) => {
    setSecretState(value);
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const client = useMemo(() => createClient(secret), [secret]);

  const value = useMemo<TrpcContextValue>(
    () => ({ client, secret, setSecret }),
    [client, secret, setSecret],
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
