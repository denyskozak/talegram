import { Buffer } from 'node:buffer';

const DEFAULT_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.mystenlabs.com';
const DEFAULT_GATEWAY_URL = 'https://gateway.walrus-testnet.mystenlabs.com';

export type WalrusStorageUploadParams = {
  data: Buffer;
  fileName: string;
  contentType?: string;
};

export type WalrusStorageUploadResult = {
  blobId: string;
  url: string;
  size: number;
  mimeType?: string;
  contentDigest?: string;
  epochsStoredFor?: number;
};

type WalrusWriteBlobParams = {
  blob: Uint8Array;
  deletable?: boolean;
  epochs?: number;
  signer?: unknown;
  fileName?: string;
  contentType?: string;
};

type WalrusWriteBlobResult = {
  blobId: string;
  contentDigest?: string;
  epochsStoredFor?: number;
};

class WalrusClient {
  private readonly aggregatorUrl: string;
  private readonly gatewayUrl: string;

  public constructor(options?: { aggregatorUrl?: string; gatewayUrl?: string }) {
    this.aggregatorUrl = normalizeUrl(options?.aggregatorUrl, DEFAULT_AGGREGATOR_URL);
    this.gatewayUrl = normalizeUrl(options?.gatewayUrl, DEFAULT_GATEWAY_URL);
  }

  public readonly walrus = {
    writeBlob: async (params: WalrusWriteBlobParams): Promise<WalrusWriteBlobResult> => {
      const response = await fetch(`${this.aggregatorUrl}/v1/store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: Buffer.from(params.blob).toString('base64'),
          encoding: 'base64',
          epochsToStoreFor: params.epochs,
          deletable: params.deletable ?? false,
          fileName: params.fileName,
          mimeType: params.contentType ?? 'application/octet-stream',
        }),
      });

      if (!response.ok) {
        const details = await safeReadError(response);
        throw new Error(
          `Failed to upload blob to Walrus (status ${response.status}): ${details}`,
        );
      }

      const result = (await response.json()) as WalrusStoreResponse;
      const blobId = extractBlobId(result);
      if (!blobId) {
        throw new Error('Walrus aggregator response did not include a blobId');
      }

      return {
        blobId,
        contentDigest: extractContentDigest(result),
        epochsStoredFor: result.epochsToStoreFor ?? result.reference?.epochsToStoreFor,
      };
    },
  } as const;

  public buildBlobUrl(blobId: string): string {
    return `${this.gatewayUrl}/v1/blobs/${encodeURIComponent(blobId)}`;
  }
}

let cachedClient: WalrusClient | undefined;

function resolveWalrusClient(): WalrusClient {
  if (!cachedClient) {
    cachedClient = new WalrusClient({
      aggregatorUrl: process.env.WALRUS_AGGREGATOR_URL,
      gatewayUrl: process.env.WALRUS_GATEWAY_URL,
    });
  }
  return cachedClient;
}

function resolveEpochsToStoreFor(): number | undefined {
  const raw = process.env.WALRUS_EPOCHS_TO_STORE_FOR;
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

export async function uploadToWalrusStorage(
  params: WalrusStorageUploadParams,
): Promise<WalrusStorageUploadResult> {
  const client = resolveWalrusClient();
  const writeResult = await client.walrus.writeBlob({
    blob: params.data,
    fileName: params.fileName,
    contentType: params.contentType,
    epochs: resolveEpochsToStoreFor(),
  });

  return {
    blobId: writeResult.blobId,
    url: client.buildBlobUrl(writeResult.blobId),
    size: params.data.byteLength,
    mimeType: params.contentType,
    contentDigest: writeResult.contentDigest,
    epochsStoredFor: writeResult.epochsStoredFor,
  };
}

type WalrusStoreResponse = {
  blobId?: string;
  digest?: string;
  contentDigest?: string;
  blobSize?: number;
  size?: number;
  epochsToStoreFor?: number;
  reference?: {
    blobId?: string;
    contentDigest?: string;
    epochsToStoreFor?: number;
  };
};

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim() || 'No response body';
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}

function extractBlobId(result: WalrusStoreResponse): string | undefined {
  if (result.blobId) {
    return result.blobId;
  }
  if (result.reference?.blobId) {
    return result.reference.blobId;
  }
  return undefined;
}

function extractContentDigest(result: WalrusStoreResponse): string | undefined {
  if (result.contentDigest) {
    return result.contentDigest;
  }
  if (result.digest) {
    return result.digest;
  }
  if (result.reference?.contentDigest) {
    return result.reference.contentDigest;
  }
  return undefined;
}

function normalizeUrl(candidate: string | undefined, fallback: string): string {
  if (!candidate || !candidate.trim()) {
    return fallback;
  }
  const trimmed = candidate.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}
