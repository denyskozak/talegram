import { createRouter } from './trpc.js';
import { catalogRouter } from '../routers/catalog.js';
import { purchasesRouter } from '../routers/purchases.js';
import { paymentsRouter } from '../routers/payments.js';
import { proposalsRouter } from '../routers/proposals.js';
import { adminRouter } from '../routers/admin.js';
import { storageRouter } from '../routers/storage.js';
import { authorsRouter } from '../routers/authors.js';

export const appRouter = createRouter({
  authors: authorsRouter,
  admin: adminRouter,
  catalog: catalogRouter,
  purchases: purchasesRouter,
  payments: paymentsRouter,
  proposals: proposalsRouter,
  storage: storageRouter,
});
