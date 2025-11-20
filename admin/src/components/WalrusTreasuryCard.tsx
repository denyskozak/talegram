import { useEffect, useMemo, useState } from 'react';
import { useTrpc } from '../api/trpcProvider.js';

const REFRESH_INTERVAL_MS = 30_000;
const FRACTION_DIGITS = 4;

export type WalletCoinBalance = {
  coinType: string;
  symbol: string;
  totalBalance: string;
  decimals: number;
};

export type WalletBalancesResponse = {
  address: string;
  coins: WalletCoinBalance[];
};

function formatBalance(balance: WalletCoinBalance): string {
  if (!balance.totalBalance) {
    return '0';
  }

  const decimals = Math.max(0, balance.decimals);
  const raw = BigInt(balance.totalBalance);

  if (decimals === 0) {
    return raw.toString();
  }

  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === 0n) {
    return whole.toString();
  }

  const paddedFraction = fraction.toString().padStart(decimals, '0');
  const trimmed = paddedFraction
    .slice(0, Math.min(decimals, FRACTION_DIGITS))
    .replace(/0+$/, '');

  return trimmed.length > 0 ? `${whole.toString()}.${trimmed}` : whole.toString();
}

export function WalrusTreasuryCard(): JSX.Element {
  const { client } = useTrpc();
  const [wallet, setWallet] = useState<WalletBalancesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const load = async (useInitialLoading: boolean) => {
      if (useInitialLoading) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = (await client.wallet.getBalances.query()) as WalletBalancesResponse;
        if (cancelled) {
          return;
        }

        setWallet(response);
        setError(null);
      } catch (cause) {
        console.error('Failed to fetch wallet balances', cause);
        if (cancelled) {
          return;
        }

        setError('Unable to load balances. Please try again.');
      } finally {
        if (cancelled) {
          return;
        }

        if (useInitialLoading) {
          setIsInitialLoading(false);
        }
        setIsRefreshing(false);

        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }

        refreshTimeout = setTimeout(() => {
          void load(false);
        }, REFRESH_INTERVAL_MS);
      }
    };

    void load(true);

    return () => {
      cancelled = true;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [client]);

  const balances = useMemo(() => wallet?.coins ?? [], [wallet]);

  return (
    <section className="settings__card walrus">
      <div className="walrus__header">
        <div>
          <h2>Walrus treasury</h2>
          <p className="settings__description">Storage fees on Sui are paid from this shared wallet.</p>
        </div>
        <div className="walrus__refresh">
          {isRefreshing ? 'Updating balances…' : 'Auto-refreshes every 30s'}
        </div>
      </div>

      <div className="walrus__grid">
        <div className="walrus__block">
          <span className="walrus__label">Public address</span>
          <code className="walrus__address">{wallet?.address ?? '—'}</code>
        </div>

        <div className="walrus__block">
          <span className="walrus__label">Balances</span>
          {isInitialLoading && <p className="walrus__hint">Loading balances…</p>}
          {!isInitialLoading && error && <p className="walrus__error">{error}</p>}
          {!isInitialLoading && !error && (
            balances.length === 0 ? (
              <p className="walrus__hint">No balances available.</p>
            ) : (
              <ul className="walrus__balances">
                {balances.map((coin) => (
                  <li key={coin.coinType}>
                    <span className="walrus__symbol">{coin.symbol}</span>
                    <span>
                      {formatBalance(coin)} {coin.symbol}
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </div>
    </section>
  );
}
