import { randomBytes } from 'node:crypto';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
console.log("ADMIN_PASSWORD: ", ADMIN_PASSWORD);
const TOKEN_TTL_MS = Number.parseInt(process.env.ADMIN_TOKEN_TTL_MS ?? '', 10);
const DEFAULT_TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const effectiveTtlMs = Number.isFinite(TOKEN_TTL_MS) && TOKEN_TTL_MS > 0 ? TOKEN_TTL_MS : DEFAULT_TOKEN_TTL_MS;

const activeTokens = new Map<string, number>();

function cleanupExpiredTokens(now = Date.now()): void {
  for (const [token, expiresAt] of activeTokens.entries()) {
    if (expiresAt <= now) {
      activeTokens.delete(token);
    }
  }
}

export function validateAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function issueAdminToken(): { token: string; expiresAt: Date } {
  cleanupExpiredTokens();
  const token = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + effectiveTtlMs);
  activeTokens.set(token, expiresAt.getTime());
  return { token, expiresAt };
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  cleanupExpiredTokens();
  if (!token) {
    return false;
  }

  const expiresAt = activeTokens.get(token);
  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    activeTokens.delete(token);
    return false;
  }

  return true;
}

export function revokeAdminToken(token: string): void {
  activeTokens.delete(token);
}
