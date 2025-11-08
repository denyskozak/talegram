import type {
  BookProposal,
  ProposalVotingListResponse,
  SubmitProposalVoteResult,
} from './types';
import { arrayBufferToBase64 } from '@/shared/lib/base64';

const DEFAULT_BACKEND_URL = 'http://localhost:3000';

function resolveBackendUrl(): string {
  const rawUrl = import.meta.env.VITE_BACKEND_URL ?? DEFAULT_BACKEND_URL;
  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
}

async function callTrpcProcedure<T>(procedure: string, payload?: unknown): Promise<T> {
  const endpoint = `${resolveBackendUrl()}/${procedure}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Env': 'true',
    },
    body: typeof payload === 'undefined' ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request to ${procedure} failed: ${response.statusText}`);
  }

  const body = await response.json();

  if (body.error) {
    throw new Error(body.error.message ?? 'Unknown server error');
  }

  const data = body.result?.data?.json as T | undefined;

  if (typeof data === 'undefined') {
    throw new Error('Unexpected server response');
  }

  return data;
}

export type SubmitProposalPayload = {
  title: string;
  author: string;
  description: string;
  file: File;
  coverFile: File;
};

export async function submitBookProposal(
  payload: SubmitProposalPayload,
): Promise<BookProposal> {
  const fileBuffer = await payload.file.arrayBuffer();
  const base64 = await arrayBufferToBase64(fileBuffer);
  const coverBuffer = await payload.coverFile.arrayBuffer();
  const coverBase64 = await arrayBufferToBase64(coverBuffer);

  return callTrpcProcedure<BookProposal>('proposals.create', {
    title: payload.title,
    author: payload.author,
    description: payload.description,
    file: {
      name: payload.file.name,
      mimeType: payload.file.type || undefined,
      size: payload.file.size,
      content: base64,
    },
    cover: {
      name: payload.coverFile.name,
      mimeType: payload.coverFile.type || undefined,
      size: payload.coverFile.size,
      content: coverBase64,
    },
  });
}

export async function fetchProposalsForVoting(
  telegramUserId: string,
): Promise<ProposalVotingListResponse> {
  return callTrpcProcedure<ProposalVotingListResponse>('proposals.listForVoting', {
    telegramUserId,
  });
}

export type SubmitProposalVotePayload = {
  proposalId: string;
  telegramUserId: string;
  isPositive: boolean;
};

export async function submitProposalVote(
  payload: SubmitProposalVotePayload,
): Promise<SubmitProposalVoteResult> {
  return callTrpcProcedure<SubmitProposalVoteResult>('proposals.vote', payload);
}
