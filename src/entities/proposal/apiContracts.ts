import type { GlobalCategory } from "@/shared/constants/globalCategories";

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
};

export type SubmitProposalVotePayload = {
  proposalId: string;
  telegramUsername: string;
  isPositive: boolean;
};

export type ListProposalsForVotingInput = {
  telegramUsername?: string;
};

export type GetProposalByIdInput = {
  proposalId: string;
  telegramUsername?: string;
};
