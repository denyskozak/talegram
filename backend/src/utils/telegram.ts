import { TRPCError } from '@trpc/server';

const DEFAULT_ALLOWED_TELEGRAM_IDS: string[] = [];

const allowedTelegramIds = new Set(
  [
    ...DEFAULT_ALLOWED_TELEGRAM_IDS,
    ...(process.env.ALLOWED_TELEGRAM_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  ],
);

export function getAllowedTelegramVoterIds(): readonly string[] {
  return Array.from(allowedTelegramIds);
}

export function isAllowedTelegramVoter(telegramUserId: string): boolean {
  return allowedTelegramIds.has(telegramUserId);
}

export function assertAllowedTelegramVoter(telegramUserId: string): void {
  if (!isAllowedTelegramVoter(telegramUserId)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Voting is not available for this Telegram user',
    });
  }
}
