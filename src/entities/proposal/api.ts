import type {
  BookProposal,
  ProposalVotingListResponse,
  SubmitProposalVoteResult,
} from "./types";
import { trpc, resolveBackendUrl } from "@/shared/api/trpc";
import { toGlobalCategory } from "@/shared/constants/globalCategories";
import type {
  GetProposalByIdInput,
  ListProposalsForVotingInput,
  SubmitProposalPayload,
  SubmitProposalVotePayload,
} from "./apiContracts";

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

type RawProposalVotes = {
  positiveVotes: number;
  negativeVotes: number;
  userVote: string | null;
};

type RawProposalForVoting = Omit<BookProposal, 'globalCategory' | 'coverWalrusFileId' | 'coverWalrusBlobId' | 'votes'> & {
  globalCategory: string | null;
  coverWalrusFileId: string | null;
  coverWalrusBlobId: string | null;
  votes: RawProposalVotes;
};

export async function fetchProposalsForVoting(
  telegramUsername?: string,
): Promise<ProposalVotingListResponse> {
  const response = await trpc.proposals.listForVoting.query({
    telegramUsername,
  } satisfies ListProposalsForVotingInput);

  return {
    allowedVotersCount: response.allowedVotersCount,
    proposals: response.proposals.map((proposal: RawProposalForVoting) => ({
      ...proposal,
      globalCategory: toGlobalCategory(proposal.globalCategory) ?? "book",
      coverWalrusFileId: proposal.coverWalrusFileId ?? null,
      coverWalrusBlobId: proposal.coverWalrusBlobId ?? null,
      votes: {
        positiveVotes: proposal.votes.positiveVotes,
        negativeVotes: proposal.votes.negativeVotes,
        userVote:
          proposal.votes.userVote === "positive"
            ? "positive"
            : proposal.votes.userVote === "negative"
              ? "negative"
              : null,
      },
    })),
  };
}

export async function fetchProposalById(
  proposalId: string,
  telegramUsername?: string,
): Promise<BookProposal> {
  const proposal = (await trpc.proposals.getById.query({
    proposalId,
    telegramUsername,
  } satisfies GetProposalByIdInput)) as RawProposalForVoting;

  return {
    ...proposal,
    globalCategory: toGlobalCategory(proposal.globalCategory) ?? "book",
    coverWalrusFileId: proposal.coverWalrusFileId ?? null,
    coverWalrusBlobId: proposal.coverWalrusBlobId ?? null,
    votes: {
      positiveVotes: proposal.votes.positiveVotes,
      negativeVotes: proposal.votes.negativeVotes,
      userVote:
        proposal.votes.userVote === "positive"
          ? "positive"
          : proposal.votes.userVote === "negative"
            ? "negative"
            : null,
    },
  };
}

export async function submitProposalVote(
  payload: SubmitProposalVotePayload,
): Promise<SubmitProposalVoteResult> {
  const result = await trpc.proposals.voteForProposal.mutate(payload);

  if (result.userVote !== "positive" && result.userVote !== "negative") {
    throw new Error(`Unexpected vote result: ${result.userVote}`);
  }

  return result as SubmitProposalVoteResult;
}
