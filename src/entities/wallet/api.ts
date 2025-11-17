import { trpc } from '@/shared/api/trpc';
import type { WalletBalancesResponse } from './types';

export const walletApi = {
  async getBalances(): Promise<WalletBalancesResponse> {
    return trpc.wallet.getBalances.query();
  },
};
