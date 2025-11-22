import {trpc} from "@/shared/api/trpc.ts";
import {ProposalStatus} from "../../../backend/src/entities/BookProposal.ts";

export type BookProposal = Awaited<ReturnType<typeof trpc.proposals.getById.query>>;

export type ProposalVoteChoice = string;

export type ProposalVotingStats = {
    positiveVotes: number;
    negativeVotes: number;
    userVote: ProposalVoteChoice | null;
};

export type ProposalForVoting = BookProposal & {
    votes: ProposalVotingStats;
};

export type ProposalVotingListResponse = Awaited<ReturnType<typeof trpc.proposals.listForVoting.query>>;

export type SubmitProposalVoteResult = {
    approvedBookId: string | null;
    status: ProposalStatus;
    positiveVotes: number;
    negativeVotes: number;
    allowedVotersCount: number;
    userVote: ProposalVoteChoice;
};
