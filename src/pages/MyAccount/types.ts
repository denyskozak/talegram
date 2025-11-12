import type { ProposalForVoting } from "@/entities/proposal/types";

import { BOOK_SECTION, PUBLISH_SECTION, VOTE_SECTION } from "./constants";

export type AccountSection =
  | typeof BOOK_SECTION
  | typeof PUBLISH_SECTION
  | typeof VOTE_SECTION;

export type VoteDirection = "positive" | "negative";

export type PublishFormState = {
  title: string;
  author: string;
  description: string;
  category: string;
  price: string;
  hashtags: string[];
  hashtagsInput: string;
  fileName: string;
  file: File | null;
  coverFileName: string;
  coverFile: File | null;
};

export type PublishResultState =
  | { status: "success"; title: string }
  | { status: "error" };

export type PendingVoteState = {
  proposalId: string;
  direction: VoteDirection;
} | null;

export type MyBook = {
  id: string;
  title: string;
  author: string;
  cover: string;
  collection: string;
  tokenId: string;
  status: "owned" | "listed";
};

export type VotingProposal = ProposalForVoting & {
  coverPreviewUrl?: string | null;
};
