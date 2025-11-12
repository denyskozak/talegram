import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EntityManager } from 'typeorm';
import { Book } from '../entities/Book.js';
import { BookProposal, ProposalStatus } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';
import { createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { normalizeCategoryId } from '../utils/categories.js';
import { fetchWalrusCoverData } from '../utils/walrus-cover.js';
import {
  MAX_COVER_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  createBookProposal,
} from '../services/proposals/create.js';
import {
  assertAllowedTelegramVoter,
  getAllowedTelegramVoterUsernames,
  isAllowedTelegramVoter,
  normalizeTelegramUsername,
} from '../utils/telegram.js';

const MAX_HASHTAGS = 8;
const REQUIRED_APPROVALS = 1;
const REQUIRED_REJECTIONS = 2;

const hashtagSchema = z.string().min(1).max(64);

const createProposalInput = z.object({
  title: z.string().min(1).max(512),
  author: z.string().min(1).max(512),
  description: z.string().min(1),
  category: z.string().min(1).max(256),
  price: z.number().int().min(0).max(1_000_000),
  hashtags: z.array(hashtagSchema).max(MAX_HASHTAGS).optional(),
  file: z.object({
    name: z.string().min(1).max(512),
    mimeType: z.string().min(1).max(128).optional(),
    size: z.number().int().nonnegative().max(MAX_FILE_SIZE_BYTES).optional(),
    content: z.string().min(1),
  }),
  cover: z.object({
    name: z.string().min(1).max(512),
    mimeType: z.string().min(1).max(128).optional(),
    size: z.number().int().nonnegative().max(MAX_COVER_FILE_SIZE_BYTES).optional(),
    content: z.string().min(1),
  }),
});

const listForVotingInput = z.object({
  telegramUsername: z.string().min(1).optional(),
});

const voteOnProposalInput = z.object({
  proposalId: z.string().uuid(),
  telegramUsername: z.string().min(1),
  isPositive: z.boolean(),
});

const getProposalByIdInput = z.object({
  proposalId: z.string().uuid(),
});

async function withProposalCover<T extends {
  coverWalrusBlobId: string | null;
  coverMimeType: string | null;
}>(proposal: T): Promise<T & { coverImageURL: string | null }> {
  const coverImageData = await fetchWalrusCoverData(proposal.coverWalrusBlobId, proposal.coverMimeType);
  return {
    ...proposal,
    coverImageURL: coverImageData.length > 0 ? coverImageData : null,
  };
}

export const proposalsRouter = createRouter({
  create: procedure.input(createProposalInput).mutation(async ({ input }) => {
    const fileBuffer = Buffer.from(input.file.content, 'base64');
    const coverBuffer = Buffer.from(input.cover.content, 'base64');

    if (input.file.size && input.file.size > MAX_FILE_SIZE_BYTES) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'File size exceeds the allowed limit' });
    }

    if (input.cover.size && input.cover.size > MAX_COVER_FILE_SIZE_BYTES) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cover size exceeds the allowed limit' });
    }

    const proposal = await createBookProposal({
      title: input.title,
      author: input.author,
      description: input.description,
      category: input.category,
      price: input.price,
      hashtags: input.hashtags ?? [],
      file: {
        name: input.file.name,
        mimeType: input.file.mimeType,
        size: input.file.size,
        data: fileBuffer,
      },
      cover: {
        name: input.cover.name,
        mimeType: input.cover.mimeType,
        size: input.cover.size,
        data: coverBuffer,
      },
    });

    return withProposalCover(proposal);
  }),
  list: procedure.query(async () => {
    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);
    const proposals = await bookProposalRepository.find({
      order: { createdAt: 'DESC' },
    });

    return Promise.all(proposals.map((proposal) => withProposalCover(proposal)));
  }),
  listForVoting: procedure.input(listForVotingInput).query(async ({ input }) => {
    const normalizedTelegramUsername = normalizeTelegramUsername(input.telegramUsername ?? null);
    const isAllowedToViewVotes =
      typeof normalizedTelegramUsername === 'string' &&
      isAllowedTelegramVoter(normalizedTelegramUsername);

    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);

    const proposals = await bookProposalRepository.find({
      where: { status: ProposalStatus.PENDING },
      order: { createdAt: 'DESC' },
      relations: { votes: true },
    });

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

      const { votes: _votes, ...rest } = proposal;

      return {
        ...rest,
        votes: {
          positiveVotes,
          negativeVotes,
          userVote: userVote ? (userVote.isPositive ? 'positive' : 'negative') : null,
        },
      };
    });

    const proposalsWithCovers = await Promise.all(
      normalized.map((proposal) => withProposalCover(proposal)),
    );

    return {
      allowedVotersCount: getAllowedTelegramVoterUsernames().length,
      proposals: proposalsWithCovers,
    };
  }),
  getById: procedure.input(getProposalByIdInput).query(async ({ input }) => {
    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);

    const proposal = await bookProposalRepository.findOne({ where: { id: input.proposalId } });
    if (!proposal) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
    }

    return withProposalCover(proposal);
  }),
  vote: procedure.input(voteOnProposalInput).mutation(async ({ input }) => {
    const normalizedTelegramUsername = assertAllowedTelegramVoter(input.telegramUsername);

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
        const walrusBlobUrl = proposal.walrusBlobUrl;
        if (!walrusBlobUrl) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing walrus blob URL for approved proposal' });
        }

        if (!proposal.fileEncryptionIv || !proposal.fileEncryptionTag) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Missing encryption metadata for approved proposal',
          });
        }

        const categoryId = normalizeCategoryId(proposal.category);
        const tags = Array.isArray(proposal.hashtags) ? proposal.hashtags : [];

        const book = bookRepository.create({
          title: proposal.title,
          author: proposal.author,
          description: proposal.description,
          walrusBlobId: proposal.walrusBlobId,
          walrusBlobUrl,
          coverWalrusBlobId: proposal.coverWalrusBlobId,
          coverMimeType: proposal.coverMimeType,
          coverFileName: proposal.coverFileName,
          coverFileSize: proposal.coverFileSize,
          mimeType: proposal.mimeType,
          fileName: proposal.fileName,
          fileSize: proposal.fileSize,
          fileEncryptionIv: proposal.fileEncryptionIv,
          fileEncryptionTag: proposal.fileEncryptionTag,
          proposalId: proposal.id,
          categories: [categoryId],
          tags,
          priceStars: Number.isFinite(proposal.price) ? Math.max(0, proposal.price) : 0,
          ratingAverage: 0,
          ratingVotes: 0,
          reviewsCount: 0,
          publishedAt: new Date(),
        });
        const savedBook = await bookRepository.save(book);

        const persistedBook = await bookRepository.findOne({ where: { id: savedBook.id } });
        if (!persistedBook) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to move approved proposal to books table",
          });
        }

        await voteRepository.delete({ proposalId: input.proposalId });

        const deleteResult = await proposalRepository.delete({ id: input.proposalId });
        if (!deleteResult.affected) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to remove proposal after publishing",
          });
        }

        return {
          status: 'APPROVED' as const,
          positiveVotes,
          negativeVotes,
        };
      }

      if (negativeVotes >= REQUIRED_REJECTIONS) {
        await voteRepository.delete({ proposalId: input.proposalId });
        await proposalRepository.delete({ id: input.proposalId });

        return {
          status: 'REJECTED' as const,
          positiveVotes,
          negativeVotes,
        };
      }

      return {
        status: 'PENDING' as const,
        positiveVotes,
        negativeVotes,
      };
    });

    return {
      proposalId: input.proposalId,
      status: result.status,
      positiveVotes: result.positiveVotes,
      negativeVotes: result.negativeVotes,
      allowedVotersCount,
      userVote: input.isPositive ? 'positive' : 'negative',
    };
  }),
});
