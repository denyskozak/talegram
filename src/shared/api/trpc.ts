import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/shared/api/appRouter";
import type { Category } from "@/entities/category/types";
import type {
  CreateReviewPayload,
  ListBooksPayload,
  ListCategoriesPayload,
  ListReviewsPayload,
} from "@/entities/book/apiContracts";
import type { Book, ID, Review } from "@/entities/book/types";
import type { Author } from "@/entities/author/types";
import type {
  ConfirmPurchasePayload,
  ConfirmPurchaseResponse,
  PurchaseStatus,
  PurchaseStatusPayload,
  PurchasesListPayload,
  PurchasesListResponse,
} from "@/entities/purchase/types";
import type { Invoice, CreateInvoicePayload } from "@/entities/payment/types";
import type {
  GetProposalByIdInput,
  ListProposalsForVotingInput,
  SubmitProposalPayload,
  SubmitProposalVotePayload,
} from "@/entities/proposal/apiContracts";
import type {
  BookProposal,
  ProposalVotingListResponse,
  SubmitProposalVoteResult,
} from "@/entities/proposal/types";
import type { GlobalCategory } from "@/shared/constants/globalCategories";

const DEFAULT_BACKEND_URL = "http://localhost:3000";

type QueryProcedure<TInput, TOutput> = {
  query: (input: TInput) => Promise<TOutput>;
};

type MutationProcedure<TInput, TOutput> = {
  mutate: (input: TInput) => Promise<TOutput>;
};

type CatalogRouter = {
  listCategories: QueryProcedure<ListCategoriesPayload | undefined, Category[]>;
  listGlobalCategories: QueryProcedure<void, GlobalCategory[]>;
  listBooks: QueryProcedure<ListBooksPayload, { items: Book[]; nextCursor?: string }>;
  getBook: QueryProcedure<{ id: ID; telegramUserId?: string }, Book>;
  listReviews: QueryProcedure<ListReviewsPayload, { items: Review[]; nextCursor?: string }>;
  createReview: MutationProcedure<CreateReviewPayload, Review>;
  listCategoryTags: QueryProcedure<{ categoryId: ID; limit?: number }, string[]>;
};

type AuthorsRouter = {
  list: QueryProcedure<void, Author[]>;
};

type ProposalsRouter = {
  listForVoting: QueryProcedure<ListProposalsForVotingInput, ProposalVotingListResponse>;
  getById: QueryProcedure<GetProposalByIdInput, BookProposal>;
  voteForProposal: MutationProcedure<SubmitProposalVotePayload, SubmitProposalVoteResult>;
  submitProposal?: MutationProcedure<SubmitProposalPayload, BookProposal>;
};

type PurchasesRouter = {
  getStatus: QueryProcedure<PurchaseStatusPayload, PurchaseStatus>;
  confirm: MutationProcedure<ConfirmPurchasePayload, ConfirmPurchaseResponse>;
  list: QueryProcedure<PurchasesListPayload, PurchasesListResponse>;
};

type PaymentsRouter = {
  createInvoice: MutationProcedure<CreateInvoicePayload, Invoice>;
};

type TrpcClient = {
  catalog: CatalogRouter;
  authors: AuthorsRouter;
  proposals: ProposalsRouter;
  purchases: PurchasesRouter;
  payments: PaymentsRouter;
};

export function resolveBackendUrl(): string {
  const rawUrl = import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return DEFAULT_BACKEND_URL;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}
const backendUrl = resolveBackendUrl();

const rawClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: backendUrl,
      headers() {
        return {
          "X-Test-Env": "true",
          "ngrok-skip-browser-warning": "true"
        };
      },
    }),
  ],
});

export const trpc = rawClient as unknown as TrpcClient;

