# Books Miniapp API (tRPC)

A minimal type-safe API built with Node.js, TypeScript, and [tRPC](https://trpc.io/). It exposes in-memory catalog, purchase, and payment procedures that mirror the needs of the Telegram mini app frontend.

## Features

- tRPC router with automatic validation powered by Zod
- Catalog procedures for categories, book listings, book details, and reviews
- Purchase utilities to confirm and inspect book purchases stored in the SQLite database with Telegram user identifiers
- Payment invoice generator that mimics Telegram Stars invoices
- Mandatory `X-Test-Env: true` header middleware for all procedures

## Getting Started

```bash
npm install
npm run dev
```

The development server runs on port `3000` by default. Override the port using a `.env` file with `PORT=4000`, or set the `PORT` environment variable when starting the server.

By default the API stores data in a local SQLite database located at `database.sqlite` in the backend directory. Override the path by setting `DATABASE_URL=/path/to/database.sqlite` before starting the server.

## Example Requests

All requests must include the header `X-Test-Env: true` and follow the JSON-RPC payload that `@trpc/server` expects.

```bash
# Fetch categories
curl -H "X-Test-Env: true" \
  -H "Content-Type: application/json" \
  --data '{"id":1,"jsonrpc":"2.0","method":"catalog.listCategories","params":{}}' \
  http://localhost:3000

# Confirm a purchase
curl -H "X-Test-Env: true" \
  -H "Content-Type: application/json" \
  --data '{"id":2,"jsonrpc":"2.0","method":"purchases.confirm","params":{"bookId":"clean-code","paymentId":"demo","telegramUserId":"123456"}}' \
  http://localhost:3000
```

Use your preferred tRPC client on the frontend to call the same procedures.

## File storage

Proposal uploads are streamed directly to the local filesystem under `FILE_STORAGE_ROOT`
and their absolute paths are stored in the database. Configure the storage root path with the
`FILE_STORAGE_ROOT` environment variable; it defaults to `data/storage` inside the backend
working directory.
