import type { AnyRouter } from "@trpc/server";
import type {
  AuthorSummary,
  Book,
  BookFormValues,
  Category,
  CreateAuthorPayload,
  DeleteBookPayload,
  LoginPayload,
  LoginResponse,
  UpdateBookPayload,
} from "../types/catalog";

type QueryProcedure<TOutput, TInput = void> = TInput extends void
  ? { query: () => Promise<TOutput> }
  : { query: (input: TInput) => Promise<TOutput> };

type MutationProcedure<TInput, TOutput> = {
  mutate: (input: TInput) => Promise<TOutput>;
};

type AdminRouter = {
  login: MutationProcedure<LoginPayload, LoginResponse>;
  listAuthors: QueryProcedure<AuthorSummary[]>;
  createAuthor: MutationProcedure<CreateAuthorPayload, AuthorSummary>;
  listBooks: QueryProcedure<Book[]>;
  getBook: QueryProcedure<Book, { id: string }>;
  createBook: MutationProcedure<BookFormValues, Book>;
  updateBook: MutationProcedure<UpdateBookPayload, Book>;
  deleteBook: MutationProcedure<DeleteBookPayload, void>;
};

type CatalogRouter = {
  listCategories: QueryProcedure<Category[]>;
};

export type AdminTrpcClient = {
  admin: AdminRouter;
  catalog: CatalogRouter;
};

export type AppRouter = AnyRouter;
