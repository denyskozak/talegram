import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';
import {
  TonStorageNotFoundError,
  decryptTonStoragePayload,
  downloadFromTonStorage,
} from '../services/ton-storage.js';
import { prisma } from '../utils/prisma.js';

export const TON_STORAGE_PROXY_PREFIX = '/ton-storage/files/';

type FileMetadata = {
  fileName?: string | null;
  mimeType?: string | null;
};

export async function handleTonStorageProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(TON_STORAGE_PROXY_PREFIX)) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const keySegment = url.pathname.slice(TON_STORAGE_PROXY_PREFIX.length);
  if (!keySegment) {
    res.statusCode = 400;
    res.end('Missing key');
    return;
  }

  const decodedKey = decodeURIComponent(keySegment);
  if (!isValidKey(decodedKey)) {
    res.statusCode = 400;
    res.end('Invalid key');
    return;
  }

  try {
    const encryptedPayload = await downloadFromTonStorage(decodedKey);
    const decryptedPayload = decryptTonStoragePayload(encryptedPayload);
    const metadata = await findFileMetadata(decodedKey);

    const fileName = metadata?.fileName ?? decodedKey;
    const mimeType = metadata?.mimeType ?? 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', decryptedPayload.byteLength);
    res.setHeader('Content-Disposition', buildContentDisposition(fileName));
    res.end(decryptedPayload);
  } catch (error) {
    console.error('Failed to proxy TON Storage file', error);
    if (!res.headersSent) {
      res.statusCode = error instanceof TonStorageNotFoundError ? 404 : 500;
      res.end(error instanceof TonStorageNotFoundError ? 'File not found' : 'Internal Server Error');
    }
  }
}

async function findFileMetadata(key: string): Promise<FileMetadata | null> {
  const book = await prisma.book.findFirst({
    where: {
      OR: [{ tonStorageKey: key }, { coverTonStorageKey: key }],
    },
    select: {
      tonStorageKey: true,
      coverTonStorageKey: true,
      fileName: true,
      mimeType: true,
      coverFileName: true,
      coverMimeType: true,
    },
  });

  if (book) {
    const isCover = book.coverTonStorageKey === key;
    return {
      fileName: isCover ? book.coverFileName : book.fileName,
      mimeType: isCover ? book.coverMimeType : book.mimeType,
    };
  }

  const proposal = await prisma.bookProposal.findFirst({
    where: {
      OR: [{ tonStorageKey: key }, { coverTonStorageKey: key }],
    },
    select: {
      tonStorageKey: true,
      coverTonStorageKey: true,
      fileName: true,
      mimeType: true,
      coverFileName: true,
      coverMimeType: true,
    },
  });

  if (proposal) {
    const isCover = proposal.coverTonStorageKey === key;
    return {
      fileName: isCover ? proposal.coverFileName : proposal.fileName,
      mimeType: isCover ? proposal.coverMimeType : proposal.mimeType,
    };
  }

  return null;
}

function isValidKey(key: string): boolean {
  return key.length > 0 && path.basename(key) === key && !key.includes('..');
}

function buildContentDisposition(fileName: string): string {
  const escaped = fileName.replace(/"/g, '\\"');
  return `attachment; filename="${escaped}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
