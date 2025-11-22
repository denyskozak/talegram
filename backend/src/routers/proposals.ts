import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EntityManager } from 'typeorm';
import { Book } from '../entities/Book.js';
import { BookProposal, ProposalStatus } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';
import { authorizedProcedure, createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { fetchWalrusFilesBase64, warmWalrusFileCache } from '../utils/walrus-files.js';

import {
  assertAllowedTelegramVoter,
  getAllowedTelegramVoterUsernames,
  isAllowedTelegramVoter,
  normalizeTelegramUsername,
} from '../utils/telegram.js';

const REQUIRED_APPROVALS = 1;
const REQUIRED_REJECTIONS = 1;

const listForVotingInput = z.void();

const voteOnProposalInput = z.object({
  proposalId: z.string().uuid(),
  isPositive: z.boolean(),
});

const getProposalByIdInput = z.object({
  proposalId: z.string().uuid(),
});

export const proposalsRouter = createRouter({
  list: procedure.query(async () => {
    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);
    const proposals = await bookProposalRepository.find({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
    });

    return proposals;
  }),
  listForVoting: procedure.input(listForVotingInput).query(async ({ ctx }) => {
    const normalizedTelegramUsername = normalizeTelegramUsername(ctx.telegramAuth.username ?? null);
    const isAllowedToViewVotes =
      typeof normalizedTelegramUsername === 'string' &&
      isAllowedTelegramVoter(normalizedTelegramUsername);

    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);

    const proposals = await bookProposalRepository.find({
      where: { status: ProposalStatus.PENDING, isDeleted: false },
      order: { createdAt: 'DESC' },
      relations: { votes: true, books: true },
    });

    const coverFileIds = Array.from(
      new Set(
        proposals
          .map((proposal) => proposal.coverWalrusFileId)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      ),
    );

    const coverDataByFileId =
      coverFileIds.length > 0
        ? await fetchWalrusFilesBase64(coverFileIds)
        : new Map<string, string | null>();

    const normalized = proposals.map((proposal: BookProposal & { votes: ProposalVote[] }) => {
      const votes = proposal.votes ?? [];
      const positiveVotes = votes.filter((vote: ProposalVote) => vote.isPositive).length;
      const negativeVotes = votes.length - positiveVotes;
      const userVote =
        isAllowedToViewVotes && normalizedTelegramUsername
          ? votes.find(
              (vote: ProposalVote) => vote.telegramUsername === normalizedTelegramUsername,
            )
          : undefined;

      const firstBook = Array.isArray(proposal.books) ? proposal.books[0] ?? null : null;
      const { votes: _votes, books: _books, ...rest } = proposal;

      const coverImageData =
        proposal.coverWalrusFileId && coverDataByFileId.has(proposal.coverWalrusFileId)
          ? coverDataByFileId.get(proposal.coverWalrusFileId) ?? null
          : null;

      return {
        ...rest,
        bookId: firstBook ? firstBook.id : null,
        coverImageData,
        votes: {
          positiveVotes,
          negativeVotes,
          userVote: userVote ? (userVote.isPositive ? 'positive' : 'negative') : null,
        },
      };
    });

    return {
      allowedVotersCount: getAllowedTelegramVoterUsernames().length,
      proposals: normalized,
    };
  }),
  getById: procedure.input(getProposalByIdInput).query(async ({ input, ctx }) => {
    const normalizedTelegramUsername = normalizeTelegramUsername(ctx.telegramAuth.username ?? null);
    const isAllowedToViewVotes =
      typeof normalizedTelegramUsername === 'string' &&
      isAllowedTelegramVoter(normalizedTelegramUsername);

    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);

    const proposal = await bookProposalRepository.findOne({
      where: { id: input.proposalId, isDeleted: false },
      relations: { votes: true, books: true },
    });
    if (!proposal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
    }

    const coverImageData = proposal.coverWalrusFileId
      ? (await fetchWalrusFilesBase64([proposal.coverWalrusFileId])).get(
          proposal.coverWalrusFileId,
        ) ?? null
      : null;

    const votes = proposal.votes ?? [];
    const positiveVotes = votes.filter((vote: ProposalVote) => vote.isPositive).length;
    const negativeVotes = votes.length - positiveVotes;
    const userVote =
      isAllowedToViewVotes && normalizedTelegramUsername
        ? votes.find((vote: ProposalVote) => vote.telegramUsername === normalizedTelegramUsername)
        : undefined;

    const firstBook = Array.isArray(proposal.books) ? proposal.books[0] ?? null : null;
    const { votes: _votes, books: _books, ...rest } = proposal;

    return {
      ...rest,
      bookId: firstBook ? firstBook.id : null,
      coverImageData,
      votes: {
        positiveVotes,
        negativeVotes,
        userVote: userVote ? (userVote.isPositive ? 'positive' : 'negative') : null,
      },
    };
  }),
  voteForProposal: authorizedProcedure.input(voteOnProposalInput).mutation(async ({ input, ctx }) => {
    const normalizedTelegramUsername = assertAllowedTelegramVoter(ctx.telegramAuth.username ?? '');

    const allowedVotersCount = getAllowedTelegramVoterUsernames().length;
    await initializeDataSource();

    const result = await appDataSource.transaction(async (manager: EntityManager) => {
      const proposalRepository = manager.getRepository(BookProposal);
      const voteRepository = manager.getRepository(ProposalVote);
      const bookRepository = manager.getRepository(Book);

      const proposal = await proposalRepository.findOne({ where: { id: input.proposalId } });
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
      }

      if (proposal.isDeleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
      }

      let vote = await voteRepository.findOne({
        where: {
          proposalId: input.proposalId,
          telegramUsername: normalizedTelegramUsername,
        },
      });

      if (!vote) {
        vote = voteRepository.create({
          proposalId: input.proposalId,
          telegramUsername: normalizedTelegramUsername,
          isPositive: input.isPositive,
        });
      } else {
        vote.isPositive = input.isPositive;
      }

      await voteRepository.save(vote);

      const groupedVotesRaw = await voteRepository
        .createQueryBuilder('vote')
        .select('vote.isPositive', 'isPositive')
        .addSelect('COUNT(*)', 'count')
        .where('vote.proposalId = :proposalId', { proposalId: input.proposalId })
        .groupBy('vote.isPositive')
        .getRawMany();

      const groupedVotes = groupedVotesRaw as Array<{ isPositive: number | string | boolean; count: string }>;

      let positiveVotes = 0;
      let negativeVotes = 0;
      for (const group of groupedVotes) {
        const count = Number(group.count);
        const isPositive = group.isPositive === 1 || group.isPositive === '1' || group.isPositive === true;
        if (isPositive) {
          positiveVotes = count;
        } else {
          negativeVotes = count;
        }
      }

      if (positiveVotes >= REQUIRED_APPROVALS) {
        const walrusBlobId = proposal.walrusBlobId;
        if (!walrusBlobId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing walrus Blob Id for approved proposal' });
        }

        if (!proposal.fileEncryptionIv || !proposal.fileEncryptionTag) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Missing encryption metadata for approved proposal',
          });
        }

        // const categoryId = normalizeCategoryId(proposal.category);
        const tags = Array.isArray(proposal.hashtags) ? proposal.hashtags : [];

        const book = bookRepository.create({
          title: proposal.title,
          author: proposal.author,
          description: proposal.description,
          walrusBlobId: proposal.walrusBlobId,
          walrusFileId: proposal.walrusFileId,
            fileName: proposal.fileName,
          fileEncryptionIv: proposal.fileEncryptionIv,
          fileEncryptionTag: proposal.fileEncryptionTag,
          audiobookFileEncryptionIv: proposal.audiobookFileEncryptionIv ?? null,
          audiobookFileEncryptionTag: proposal.audiobookFileEncryptionTag ?? null,
          coverWalrusFileId: proposal.coverWalrusFileId ?? null,
          category: proposal.category,
          globalCategory: proposal.globalCategory,
          price: proposal.price,
          tags,
          currency: proposal.currency,
        });

        if (proposal.coverWalrusFileId) {
          await warmWalrusFileCache(proposal.coverWalrusFileId);
        }

        await bookRepository.save(book);

        proposal.status = ProposalStatus.APPROVED;
        proposal.books = [book];
      }

      if (negativeVotes >= REQUIRED_REJECTIONS) {
        proposal.status = ProposalStatus.REJECTED;
      }

      // proposal.approvedAt = proposal.status === ProposalStatus.APPROVED ? new Date() : null;
      // proposal.rejectedAt = proposal.status === ProposalStatus.REJECTED ? new Date() : null;

      await proposalRepository.save(proposal);

      return { proposal, positiveVotes, negativeVotes, userVote: input.isPositive ? 'positive' : 'negative' as const };
    });

    return {
      status: result.proposal.status,
      allowedVotersCount,
      positiveVotes: result.positiveVotes,
      negativeVotes: result.negativeVotes,
      userVote: result.userVote,
      approvedBookId: result.proposal.status === ProposalStatus.APPROVED && result.proposal.books?.[0]
        ? result.proposal.books[0].id
        : null,
    };
  }),
});

