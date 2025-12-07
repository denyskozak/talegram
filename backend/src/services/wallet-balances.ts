import { SUI_TYPE_ARG } from '@mysten/sui/utils';

import { getKeypair } from './keys.js';
import { suiClient } from './walrus-storage.js';

export type WalletCoinBalance = {
  coinType: string;
  symbol: string;
  totalBalance: string;
  decimals: number;
};

export type WalletBalancesResult = {
  address: string;
  coins: WalletCoinBalance[];
};

const WALRUS_SYMBOL_FALLBACK = 'WAL';

let cachedAddress: string | null = null;
let walrusCoinTypePromise: Promise<string> | null = null;

function getWalletAddress(): string {
  if (!cachedAddress) {
    const publicKey = getKeypair().getPublicKey();
    cachedAddress = publicKey.toSuiAddress();
  }

  return cachedAddress;
}

async function resolveWalrusCoinType(): Promise<string> {
  if (!walrusCoinTypePromise) {
    walrusCoinTypePromise = (async () => {
      const systemObject = await suiClient.walrus.systemObject();
      const packageId = systemObject.package_id;
      if (!packageId) {
        throw new Error('Failed to resolve Walrus package id');
      }

      // TODO Walrus Package Address
      return `0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL`;
    })().catch((error) => {
      walrusCoinTypePromise = null;
      throw error;
    });
  }

  return walrusCoinTypePromise;
}

async function fetchCoinBalance(coinType: string): Promise<WalletCoinBalance> {
  const owner = getWalletAddress();
  const [balance, metadata] = await Promise.all([
    suiClient.getBalance({ owner, coinType }),
    suiClient.getCoinMetadata({ coinType }).catch(() => null),
  ]);

  const decimals = typeof metadata?.decimals === 'number' ? metadata.decimals : 0;
  const symbol = metadata?.symbol?.trim() || (coinType === SUI_TYPE_ARG ? 'SUI' : WALRUS_SYMBOL_FALLBACK);

  return {
    coinType,
    symbol,
    decimals,
    totalBalance: balance.totalBalance,
  };
}

export async function getWalletBalances(): Promise<WalletBalancesResult> {
  const address = getWalletAddress();
  const walrusCoinType = await resolveWalrusCoinType();
  const coins = await Promise.all([
    fetchCoinBalance(SUI_TYPE_ARG),
    fetchCoinBalance(walrusCoinType),
  ]);

  return { address, coins };
}
