import {createTRPCClient, httpBatchLink} from "@trpc/client";
import type {AppRouter} from "./backendTypes";
import {retrieveRawInitData} from '@tma.js/sdk'

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
const initDataRaw = retrieveRawInitData();

export const trpc = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: backendUrl,
            headers() {
                return {
                    "X-Test-Env": "true",
                    "ngrok-skip-browser-warning": "true",
                    "Authorization": `tma ${initDataRaw}`
                };
            },
        }),
    ],
});

