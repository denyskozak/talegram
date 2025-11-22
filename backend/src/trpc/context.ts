import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { parseTelegramAuth, type TelegramAuthData } from '../utils/auth.js';

export type TRPCContext = {
  req: CreateHTTPContextOptions['req'];
  telegramAuth: TelegramAuthData;
};

export const createTRPCContext = ({ req }: CreateHTTPContextOptions): TRPCContext => ({
  req,
  telegramAuth: parseTelegramAuth(req),
});
