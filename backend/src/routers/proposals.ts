import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EntityManager } from 'typeorm';
import { Book } from '../entities/Book.js';
import { BookProposal, ProposalStatus } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';
import { CommunityMember } from '../entities/CommunityMember.js';
import { authorizedProcedure, createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { deleteStorageDirectories, fetchStoredFilesBase64, warmFileCache } from '../utils/storage-files.js';

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
    const telegramUserId = ctx.telegramAuth.userId;

    await initializeDataSource();
    const communityMemberRepository = appDataSource.getRepository(CommunityMember);
    const communityMember = telegramUserId
      ? await communityMemberRepository.findOne({ where: { telegramUserId } })
      : null;

    const isAllowedToViewVotes = true;
    const bookProposalRepository = appDataSource.getRepository(BookProposal);

    const proposals = await bookProposalRepository.find({
      where: { status: ProposalStatus.PENDING, isDeleted: false },
      order: { createdAt: 'DESC' },
      relations: { votes: true},
    });

    const coverFileIds = Array.from(
      new Set(
        proposals
          .map((proposal) => proposal.coverFilePath)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      ),
    );

    const coverDataByFileId =
      coverFileIds.length > 0
        ? await fetchStoredFilesBase64(coverFileIds)
        : new Map<string, string | null>();

    const normalized = proposals.map((proposal: BookProposal & { votes: ProposalVote[] }) => {
      const votes = proposal.votes ?? [];
      const positiveVotes = votes.filter((vote: ProposalVote) => vote.isPositive).length;
      const negativeVotes = votes.length - positiveVotes;
      const userVote =
        isAllowedToViewVotes && telegramUserId
          ? votes.find((vote: ProposalVote) => vote.telegramUserId === telegramUserId)
          : undefined;

      const { votes: _votes, ...rest } = proposal;

      const coverImageData =
        proposal.coverFilePath && coverDataByFileId.has(proposal.coverFilePath)
          ? coverDataByFileId.get(proposal.coverFilePath) ?? null
          : null;

      return {
        ...rest,
        coverImageData,
        votes: {
          positiveVotes,
          negativeVotes,
          userVote: userVote ? (userVote.isPositive ? 'positive' : 'negative') : null,
        },
      };
    });

    const allowedVotersCount = await communityMemberRepository.count();

    return {
      allowedVotersCount,
      isCommunityMember: Boolean(communityMember),
      proposals: normalized,
    };
  }),
  getById: procedure.input(getProposalByIdInput).query(async ({ input, ctx }) => {
    const telegramUserId = ctx.telegramAuth.userId;

    await initializeDataSource();
    const communityMemberRepository = appDataSource.getRepository(CommunityMember);
    const communityMember = telegramUserId
      ? await communityMemberRepository.findOne({ where: { telegramUserId } })
      : null;
    const isAllowedToViewVotes = true;
    const bookProposalRepository = appDataSource.getRepository(BookProposal);

    const proposal = await bookProposalRepository.findOne({
      where: { id: input.proposalId, isDeleted: false },
      relations: { votes: true },
    });
    if (!proposal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
    }

    const coverImageData = proposal.coverFilePath
      ? (await fetchStoredFilesBase64([proposal.coverFilePath])).get(
          proposal.coverFilePath,
        ) ?? null
      : null;

    const votes = proposal.votes ?? [];
    const positiveVotes = votes.filter((vote: ProposalVote) => vote.isPositive).length;
    const negativeVotes = votes.length - positiveVotes;
    const userVote =
      isAllowedToViewVotes && telegramUserId
        ? votes.find((vote: ProposalVote) => vote.telegramUserId === telegramUserId)
        : undefined;

    const { votes: _votes, ...rest } = proposal;

    const allowedVotersCount = await communityMemberRepository.count();

    return {
      ...rest,
      coverImageData,
      votes: {
        positiveVotes,
        negativeVotes,
        userVote: userVote ? (userVote.isPositive ? 'positive' : 'negative') : null,
      },
      allowedVotersCount,
      isCommunityMember: Boolean(communityMember),
    };
  }),
  voteForProposal: authorizedProcedure.input(voteOnProposalInput).mutation(async ({ input, ctx }) => {
    const telegramUserId = ctx.telegramAuth.userId;
      console.log("ctx.telegramAuth: ", ctx.telegramAuth);
    if (!telegramUserId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Voting is not available for this Telegram user' });
    }

    await initializeDataSource();

    const communityMemberRepository = appDataSource.getRepository(CommunityMember);
    const member = await communityMemberRepository.findOne({ where: { telegramUserId } });
    if (!member) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Voting is not available for this Telegram user' });
    }

    const allowedVotersCount = await communityMemberRepository.count();

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
          telegramUserId,
        },
      });

      if (!vote) {
        vote = voteRepository.create({
          proposalId: input.proposalId,
          telegramUserId,
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
        const filePath = proposal.filePath;
        if (!filePath) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing file path for approved proposal' });
        }

        // const categoryId = normalizeCategoryId(proposal.category);
        const tags = Array.isArray(proposal.hashtags) ? proposal.hashtags : [];

        const book = bookRepository.create({
          title: proposal.title,
          author: proposal.author,
          description: proposal.description,
          filePath,
          fileName: proposal.fileName,
          audiobookFilePath: proposal.audiobookFilePath,
          coverFilePath: proposal.coverFilePath,
          coverMimeType: proposal.coverMimeType,
          coverFileName: proposal.coverFileName,
          coverFileSize: proposal.coverFileSize,
          mimeType: proposal.mimeType,
          fileSize: proposal.fileSize,
          audiobookMimeType: proposal.audiobookMimeType,
          audiobookFileName: proposal.audiobookFileName,
          audiobookFileSize: proposal.audiobookFileSize,
          publishedAt: Date.now(),
          authorTelegramUserId: proposal.submittedByTelegramUserId ?? null,
          language: proposal.language ?? null,
          category: proposal.category,
          globalCategory: proposal.globalCategory,
          price: proposal.price,
          tags,
          currency: proposal.currency,
        });

        if (proposal.coverFilePath) {
          await warmFileCache([proposal.coverFilePath]);
        }

        await bookRepository.save(book);

        proposal.status = ProposalStatus.APPROVED;
      }

      if (negativeVotes >= REQUIRED_REJECTIONS) {
        proposal.status = ProposalStatus.REJECTED;
      }

      // proposal.approvedAt = proposal.status === ProposalStatus.APPROVED ? new Date() : null;
      // proposal.rejectedAt = proposal.status === ProposalStatus.REJECTED ? new Date() : null;

      await proposalRepository.save(proposal);

      return { proposal, positiveVotes, negativeVotes, userVote: input.isPositive ? 'positive' : 'negative' as const };
    });

    if (result.proposal.status === ProposalStatus.REJECTED) {
      await deleteStorageDirectories([
        result.proposal.filePath,
        result.proposal.coverFilePath,
        result.proposal.audiobookFilePath,
      ]);
    }

    return {
      status: result.proposal.status,
      allowedVotersCount,
      positiveVotes: result.positiveVotes,
      negativeVotes: result.negativeVotes,
      userVote: result.userVote,
    };
  }),
});
