import { TRPCError } from '@trpc/server';

const DEFAULT_ALLOWED_TELEGRAM_USERNAMES: readonly string[] = [
  '@lawyerdsupport',
  '@oxfrrdd',
];

function normalizeTelegramUsername(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const prefixed = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  return prefixed.toLowerCase();
}

export function normalizeTelegramUserId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const allowedTelegramUsernames = new Set(
  [
    ...DEFAULT_ALLOWED_TELEGRAM_USERNAMES,
    ...(process.env.ALLOWED_TELEGRAM_USERNAMES ?? '')
      .split(',')
      .map((username) => normalizeTelegramUsername(username))
      .filter((username): username is string => Boolean(username)),
  ]
    .map((username) => normalizeTelegramUsername(username))
    .filter((username): username is string => Boolean(username)),
);

export function getAllowedTelegramVoterUsernames(): readonly string[] {
  return Array.from(allowedTelegramUsernames);
}

export function isAllowedTelegramVoter(telegramUsername: string): boolean {
  const normalized = normalizeTelegramUsername(telegramUsername);
  if (!normalized) {
    return false;
  }
  return allowedTelegramUsernames.has(normalized);
}

export function assertAllowedTelegramVoter(telegramUsername: string): string {
  const normalized = normalizeTelegramUsername(telegramUsername);
  if (!normalized || !allowedTelegramUsernames.has(normalized)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Voting is not available for this Telegram user',
    });
  }

  return normalized;
}

export { normalizeTelegramUsername, normalizeTelegramUserId };
