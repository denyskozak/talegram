const DEFAULT_BACKEND_URL = "http://localhost:3000";

let requestId = 0;

function nextRequestId(): number {
  requestId = (requestId + 1) % Number.MAX_SAFE_INTEGER;
  if (requestId === 0) {
    requestId = 1;
  }
  return requestId;
}

export function resolveBackendUrl(): string {
  const rawUrl = import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return DEFAULT_BACKEND_URL;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

interface TrpcErrorShape {
  message?: string;
}

interface TrpcResponse<T> {
  result?: { data?: { json?: T } };
  error?: TrpcErrorShape;
}

export async function callTrpcProcedure<T>(procedure: string, params?: unknown): Promise<T> {
  const endpoint = resolveBackendUrl();
  const payload = {
    id: nextRequestId(),
    jsonrpc: "2.0" as const,
    method: procedure,
    params,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Env": "true",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request to ${procedure} failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as TrpcResponse<T>;

  if (body.error) {
    throw new Error(body.error.message ?? "Unknown server error");
  }

  const data = body.result?.data?.json;

  if (typeof data === "undefined") {
    throw new Error("Unexpected server response");
  }

  return data;
}

