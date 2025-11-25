import type {
  BookProposal,
  ProposalVoteChoice,
  ProposalVotingListResponse,
  SubmitProposalVoteResult,
} from "./types";
import { trpc, resolveBackendUrl } from "@/shared/api/trpc";
import { retrieveRawInitData } from "@tma.js/sdk";
import type { GlobalCategory } from "@/shared/lib/globalCategories";

export type SubmitProposalPayload = {
  title: string;
  author: string;
  description: string;
  globalCategory: GlobalCategory;
  category: string;
  price: number;
  hashtags: string[];
  file: File;
  coverFile: File;
  audiobookFile?: File | null;
  language?: string | null;
  telegramUserId?: string | null;
};

export async function submitBookProposal(
  payload: SubmitProposalPayload,
): Promise<BookProposal> {
  const backendUrl = resolveBackendUrl();
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("author", payload.author);
  formData.append("description", payload.description);
  formData.append("globalCategory", payload.globalCategory);
  formData.append("category", payload.category);
  formData.append("price", payload.price.toString(10));
  formData.append("hashtags", JSON.stringify(payload.hashtags));
  formData.append("file", payload.file, payload.file.name);
  formData.append("cover", payload.coverFile, payload.coverFile.name);
  if (payload.language) {
    formData.append("language", payload.language);
  }
  if (payload.telegramUserId) {
    formData.append("telegramUserId", payload.telegramUserId);
  }
  if (payload.audiobookFile) {
    formData.append("audiobook", payload.audiobookFile, payload.audiobookFile.name);
  }

  const response = await fetch(`${backendUrl}/proposals`, {
    method: "POST",
    body: formData,
    headers: {
      "ngrok-skip-browser-warning": "true",
      Authorization: `tma ${retrieveRawInitData()}`,
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

export async function fetchProposalsForVoting(): Promise<ProposalVotingListResponse> {
  return trpc.proposals.listForVoting.query();
}

export async function fetchProposalById(proposalId: string): Promise<BookProposal> {
  return trpc.proposals.getById.query({ proposalId });
}

export type SubmitProposalVotePayload = {
  proposalId: string;
  isPositive: boolean;
};

export async function submitProposalVote(
  payload: SubmitProposalVotePayload,
): Promise<SubmitProposalVoteResult> {
  const result = await trpc.proposals.voteForProposal.mutate(payload);
  const normalizedUserVote: ProposalVoteChoice =
    result.userVote === "positive" ? "positive" : "negative";

  return { ...result, userVote: normalizedUserVote };
}
