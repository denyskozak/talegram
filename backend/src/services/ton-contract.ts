import { randomUUID } from 'crypto';

type SendBookNftParams = {
  bookId: string;
  paymentId: string;
  recipientTonAddress: string;
};

export type SendBookNftResult = {
  transactionId: string;
  nftAddress: string;
  recipientTonAddress: string;
  mintedAt: string;
};

/**
 * Simulates a TON smart-contract call that mints and sends an NFT edition of the
 * purchased book to the reader. In production this would send a message to the
 * contract and wait for the transaction confirmation.
 */
export async function sendBookNft({
  bookId,
  paymentId,
  recipientTonAddress,
}: SendBookNftParams): Promise<SendBookNftResult> {
  // Simulate network latency of the blockchain call
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });

  const transactionId = `txn_${randomUUID()}`;
  const nftAddress = `nft_${bookId}_${paymentId.slice(0, 8)}_${randomUUID().slice(0, 8)}`;

  return {
    transactionId,
    nftAddress,
    recipientTonAddress,
    mintedAt: new Date().toISOString(),
  };
}

