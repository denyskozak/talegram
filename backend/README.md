# Books Miniapp API (tRPC)

A minimal type-safe API built with Node.js, TypeScript, and [tRPC](https://trpc.io/). It exposes in-memory catalog, purchase, and payment procedures that mirror the needs of the Telegram mini app frontend.

## Features

- tRPC router with automatic validation powered by Zod
- Catalog procedures for categories, book listings, book details, and reviews
- Purchase utilities to confirm and inspect book purchases (stored in-memory)
- Payment invoice generator that mimics Telegram Stars invoices
- Mandatory `X-Test-Env: true` header middleware for all procedures

## Getting Started

```bash
npm install
npm run dev
```

The development server runs on port `3000` by default. Override the port using a `.env` file with `PORT=4000`, or set the `PORT` environment variable when starting the server.

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
  --data '{"id":2,"jsonrpc":"2.0","method":"purchases.confirm","params":{"bookId":"clean-code","paymentId":"demo"}}' \
  http://localhost:3000
```

Use your preferred tRPC client on the frontend to call the same procedures.

## Walrus Storage integration

Proposal uploads are sent to [Walrus Storage](https://sdk.mystenlabs.com/walrus)
through the Walrus TypeScript SDK client that lives in `src/services/walrus-storage.ts`.
Configure the integration through environment variables when running the API:

| Variable | Description | Default |
| --- | --- | --- |
| `WALRUS_AGGREGATOR_URL` | Walrus aggregator base URL used for uploads | `https://aggregator.walrus-testnet.mystenlabs.com` |
| `WALRUS_GATEWAY_URL` | Gateway URL used to retrieve stored blobs | `https://gateway.walrus-testnet.mystenlabs.com` |
| `WALRUS_EPOCHS_TO_STORE_FOR` | Optional number of epochs to request blob retention for | _(unset)_ |

Uploaded blob metadata (blob ids, URLs, file size, MIME types, etc.) is persisted in the application's database for future access.
