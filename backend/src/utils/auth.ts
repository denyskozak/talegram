import type http from 'node:http';

import { parse } from '@telegram-apps/init-data-node';

export type TelegramAuthData = {
  rawInitData: string | null;
  userId: string | null;
  username: string | null;
};

const AUTH_SCHEME = 'tma';

type AuthorizationHeader = string | string[] | undefined;

function extractAuthorizationValue(rawHeader: AuthorizationHeader): string | null {
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof headerValue !== 'string') {
    return null;
  }

  const [scheme, ...rest] = headerValue.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== AUTH_SCHEME) {
    return null;
  }

  const payload = rest.join(' ').trim();
  return payload.length > 0 ? payload : null;
}

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseTelegramAuth(req: http.IncomingMessage): TelegramAuthData {
  const rawInitData = extractAuthorizationValue(req.headers['authorization']);
  if (!rawInitData) {
    return { rawInitData: null, userId: null, username: null };
  }

  try {
    const parsed = parse(rawInitData);
    const user = (parsed as { user?: { id?: unknown; username?: unknown } }).user ?? {};

    return {
      rawInitData,
      userId: toOptionalString(user.id),
      username: toOptionalString(user.username),
    };
  } catch (error) {
    console.warn('Failed to parse Telegram init data', error);
    return { rawInitData, userId: null, username: null };
  }
}

export function resolveTelegramUserId(auth: TelegramAuthData, fallback?: string | null): string | null {
  return auth.userId ?? toOptionalString(fallback);
}

export function resolveTelegramUsername(auth: TelegramAuthData, fallback?: string | null): string | null {
  return auth.username ?? toOptionalString(fallback);
}
