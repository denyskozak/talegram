import type { Book } from "@/entities/book/types";
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
  globalCategory: string;
  category: string;
  price: string;
  isFree: boolean;
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

export type MyBook = {
  book: Book;
  purchase: {
    paymentId: string;
    purchasedAt: string;
    walrusBlobId: string | null;
    walrusFileId: string | null;
  };
  liked: boolean;
};

export type MyBooksFilter = "purchased" | "liked";

export type VotingProposal = ProposalForVoting & {
  coverPreviewUrl?: string | null;
};
