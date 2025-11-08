export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type BookProposal = {
  id: string;
  title: string;
  author: string;
  description: string;
  tonStorageKey: string;
  tonStorageUrl: string;
  coverTonStorageKey?: string | null;
  coverTonStorageUrl?: string | null;
  coverMimeType?: string | null;
  coverFileName?: string | null;
  coverFileSize?: number | null;
  mimeType?: string | null;
  fileName: string;
  fileSize?: number | null;
  status: ProposalStatus;
  reviewerNotes?: string | null;
  createdAt: string;
  updatedAt: string;
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
