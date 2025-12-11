import { getKeypair } from './keys.js';

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

let cachedAddress: string | null = null;

function getWalletAddress(): string {
  if (!cachedAddress) {
    const publicKey = getKeypair().getPublicKey();
    cachedAddress = publicKey.toSuiAddress();
  }

  return cachedAddress;
}

export async function getWalletBalances(): Promise<WalletBalancesResult> {
  return {
    address: getWalletAddress(),
    coins: [],
  };
}
