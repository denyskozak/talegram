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

const server = http.createServer((req, res) => {
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
