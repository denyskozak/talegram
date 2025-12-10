import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { retrieveRawInitData } from "@tma.js/sdk";
import { appRouter } from "../../../backend/src/trpc/root.ts";

const DEFAULT_BACKEND_URL = "http://localhost:3000";

export function resolveBackendUrl(): string {
    const rawUrl = import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
    const trimmed = rawUrl.trim();
    if (trimmed.length === 0) {
        return DEFAULT_BACKEND_URL;
    }

    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

const backendUrl = resolveBackendUrl();

const commonHeaders = {
    "X-Test-Env": "true",
    "ngrok-skip-browser-warning": "true",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    Expires: "0",
} as const;

export function buildAuthorizedHeaders(): Record<string, string> {
    return {
        ...commonHeaders,
        Authorization: `tma ${retrieveRawInitData()}`,
    };
}

export const trpc = createTRPCClient<typeof appRouter>({
    links: [
        httpBatchLink({
            url: backendUrl,
            headers() {
                return buildAuthorizedHeaders();
            },
        }),
    ],
});

