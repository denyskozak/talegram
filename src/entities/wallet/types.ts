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
