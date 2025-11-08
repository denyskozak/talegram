import type {
  BookProposal,
  ProposalVotingListResponse,
  SubmitProposalVoteResult,
} from './types';
import { arrayBufferToBase64 } from '@/shared/lib/base64';
import { trpc } from '@/shared/api/trpc';

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

  return trpc.mutation('proposals.create', {
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
  return trpc.query('proposals.listForVoting', {
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
  return trpc.mutation('proposals.vote', payload);
}
