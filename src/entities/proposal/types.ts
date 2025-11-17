import type { GlobalCategory } from "@/shared/lib/globalCategories";

export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type BookProposal = {
    id: string;
    title: string;
    author: string;
    description: string;
    globalCategory: GlobalCategory;
    category: string;
    price: number;
    currency: string;
    hashtags: string[];
    walrusBlobId: string;
    walrusFileId: string;
    audiobookWalrusBlobId?: string | null;
    audiobookWalrusFileId?: string | null;
    coverWalrusFileId: string | null;
    coverWalrusBlobId: string | null;
    coverMimeType?: string | null;
    coverFileName?: string | null;
    coverFileSize?: number | null;
    coverImageData?: string | null;
    mimeType?: string | null;
    fileName: string;
    fileSize?: number | null;
    audiobookMimeType?: string | null;
    audiobookFileName?: string | null;
    audiobookFileSize?: number | null;
    status: ProposalStatus;
    isDeleted: boolean;
    reviewerNotes?: string | null;
    createdAt: string;
    updatedAt: string;
    votes?: ProposalVotingStats;
};

export type ProposalVoteChoice = 'positive' | 'negative';

export type ProposalVotingStats = {
    positiveVotes: number;
    negativeVotes: number;
    userVote: ProposalVoteChoice | null;
};

export type ProposalForVoting = BookProposal & {
    votes: ProposalVotingStats;
};

export type ProposalVotingListResponse = {
    allowedVotersCount: number;
    proposals: ProposalForVoting[];
};

export type SubmitProposalVoteResult = {
    proposalId: string;
    status: ProposalStatus;
    positiveVotes: number;
    negativeVotes: number;
    allowedVotersCount: number;
    userVote: ProposalVoteChoice;
};
