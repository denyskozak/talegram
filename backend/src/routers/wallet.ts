import { createRouter, procedure } from '../trpc/trpc.js';
import { getWalletBalances } from '../services/wallet-balances.js';

export const walletRouter = createRouter({
  getBalances: procedure.query(async () => {
    return getWalletBalances();
  }),
});
