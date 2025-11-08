import { config } from 'dotenv';
import http from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './trpc/root.js';
import { createTRPCContext } from './trpc/context.js';
import {
  TON_STORAGE_PROXY_PREFIX,
  handleTonStorageProxyRequest,
} from './routers/ton-storage-proxy.js';

config();

const port = Number(process.env.PORT) || 3000;

const trpcHandler = createHTTPHandler({
  router: appRouter,
  createContext: createTRPCContext,
});

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
};

const server = http.createServer((req, res) => {
  for (const [header, value] of Object.entries(corsHeaders)) {
    res.setHeader(header, value);
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.url?.startsWith(TON_STORAGE_PROXY_PREFIX)) {
    handleTonStorageProxyRequest(req, res).catch((error) => {
      console.error('Unhandled TON Storage proxy error', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });
    return;
  }

  trpcHandler(req, res);
});

server.listen(port, () => {
  console.log(`tRPC server listening on http://localhost:${port}`);
});

export type AppRouter = typeof appRouter;
