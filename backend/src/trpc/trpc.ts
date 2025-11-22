import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCContext } from './context.js';

const t = initTRPC.context<TRPCContext>().create();

const REQUIRED_TEST_HEADER_VALUE = 'true';

const requireTestEnvMiddleware = t.middleware(({ ctx, next }) => {
  const rawHeader = ctx.req.headers['x-test-env'];
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (headerValue?.toLowerCase() !== REQUIRED_TEST_HEADER_VALUE) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'X-Test-Env header required for testnet' });
  }

  return next();
});

const requireTelegramAuthMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.telegramAuth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Telegram authorization required' });
  }

  return next();
});

export const createRouter = t.router;
export const procedure = t.procedure.use(requireTestEnvMiddleware);
export const authorizedProcedure = procedure.use(requireTelegramAuthMiddleware);
