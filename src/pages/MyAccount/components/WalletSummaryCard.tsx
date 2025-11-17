import { useEffect, useMemo, useState } from "react";
import { Card, Text, Title } from "@telegram-apps/telegram-ui";
import { useTranslation } from "react-i18next";

import { walletApi } from "@/entities/wallet/api";
import type { WalletBalancesResponse, WalletCoinBalance } from "@/entities/wallet/types";
import { useTheme } from "@/app/providers/ThemeProvider";

const REFRESH_INTERVAL_MS = 30_000;
const FRACTION_DIGITS = 4;

function formatBalance(balance: WalletCoinBalance): string {
  if (!balance.totalBalance) {
    return "0";
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

  const paddedFraction = fraction.toString().padStart(decimals, "0");
  const trimmed = paddedFraction
    .slice(0, Math.min(decimals, FRACTION_DIGITS))
    .replace(/0+$/, "");

  return trimmed.length > 0 ? `${whole.toString()}.${trimmed}` : whole.toString();
}

export function WalletSummaryCard(): JSX.Element {
  const theme = useTheme();
  const { t } = useTranslation();
  const [wallet, setWallet] = useState<WalletBalancesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const load = async (useInitialLoading: boolean) => {
      if (useInitialLoading) {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await walletApi.getBalances();
        if (!isMounted) {
          return;
        }
        setWallet(response);
        setError(null);
      } catch (cause) {
        console.error("Failed to fetch wallet balances", cause);
        if (!isMounted) {
          return;
        }
        setError(t("account.wallet.error"));
      } finally {
        if (!isMounted) {
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
      isMounted = false;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [t]);

  const balances = useMemo(() => wallet?.coins ?? [], [wallet]);

  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Title level="3" weight="2">
          {t("account.wallet.title")}
        </Title>
        <Text style={{ color: theme.subtitle }}>{t("account.wallet.description")}</Text>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Text style={{ fontSize: 14, color: theme.hint }}>{t("account.wallet.addressLabel")}</Text>
        <Text
          style={{
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace',
            wordBreak: "break-all",
          }}
        >
          {wallet?.address ?? "—"}
        </Text>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Text style={{ fontSize: 14, color: theme.hint }}>{t("account.wallet.balancesLabel")}</Text>
        {isInitialLoading && <Text>{t("account.wallet.loading")}</Text>}
        {!isInitialLoading && error && <Text style={{ color: "#f04d4d" }}>{error}</Text>}
        {!isInitialLoading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {balances.map((coin) => (
              <div key={coin.coinType} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ fontWeight: 600 }}>{coin.symbol}</Text>
                <Text>
                  {formatBalance(coin)} {coin.symbol}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>

      <Text style={{ color: theme.hint, fontSize: 13 }}>
        {isRefreshing ? t("account.wallet.refreshing") : t("account.wallet.refreshHint", { seconds: 30 })}
      </Text>
    </Card>
  );
}
