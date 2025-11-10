import type {
  BookProposal,
  ProposalVotingListResponse,
  SubmitProposalVoteResult,
} from './types';
import { trpc, resolveBackendUrl } from '@/shared/api/trpc';

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
  const backendUrl = resolveBackendUrl();
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("author", payload.author);
  formData.append("description", payload.description);
  formData.append("file", payload.file, payload.file.name);
  formData.append("cover", payload.coverFile, payload.coverFile.name);

  const response = await fetch(`${backendUrl}/proposals`, {
    method: "POST",
    body: formData,
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to submit proposal (status ${response.status}): ${errorText || "Unknown error"}`,
    );
  }

  const proposal = (await response.json()) as BookProposal;
  return proposal;
}

export async function fetchProposalsForVoting(
  telegramUserId?: string,
): Promise<ProposalVotingListResponse> {
  return trpc.proposals.listForVoting.query({
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
  return trpc.proposals.vote.mutation(payload);
}
