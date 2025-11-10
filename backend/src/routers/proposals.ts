import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EntityManager } from 'typeorm';
import { Book } from '../entities/Book.js';
import { BookProposal, ProposalStatus } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';
import { createRouter, procedure } from '../trpc/trpc.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import {
  MAX_COVER_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  createBookProposal,
} from '../services/proposals/create.js';
import {
  assertAllowedTelegramVoter,
  getAllowedTelegramVoterIds,
} from '../utils/telegram.js';

const createProposalInput = z.object({
  title: z.string().min(1).max(512),
  author: z.string().min(1).max(512),
  description: z.string().min(1),
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
  telegramUserId: z.string().min(1),
});

const voteOnProposalInput = z.object({
  proposalId: z.string().uuid(),
  telegramUserId: z.string().min(1),
  isPositive: z.boolean(),
});

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

    return proposal;
  }),
  list: procedure.query(async () => {
    await initializeDataSource();
    const bookProposalRepository = appDataSource.getRepository(BookProposal);
    const proposals = await bookProposalRepository.find({
      order: { createdAt: 'DESC' },
    });

    return proposals;
  }),
  listForVoting: procedure.input(listForVotingInput).query(async ({ input }) => {
    assertAllowedTelegramVoter(input.telegramUserId);
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
      const userVote = votes.find((vote: ProposalVote) => vote.telegramUserId === input.telegramUserId);

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

    return {
      allowedVotersCount: getAllowedTelegramVoterIds().length,
      proposals: normalized,
    };
  }),
  vote: procedure.input(voteOnProposalInput).mutation(async ({ input }) => {
    assertAllowedTelegramVoter(input.telegramUserId);

    const allowedVotersCount = getAllowedTelegramVoterIds().length;
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
          telegramUserId: input.telegramUserId,
        },
      });

      if (!vote) {
        vote = voteRepository.create({
          proposalId: input.proposalId,
          telegramUserId: input.telegramUserId,
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

      const totalVotes = positiveVotes + negativeVotes;
      if (totalVotes > 0 && positiveVotes / totalVotes > 0.5) {
        const walrusBlobUrl = proposal.walrusBlobUrl;
        if (!walrusBlobUrl) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Missing walrus blob URL for approved proposal' });
        }

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
          proposalId: proposal.id,
        });
        await bookRepository.save(book);
        await voteRepository.delete({ proposalId: input.proposalId });
        await proposalRepository.delete({ id: input.proposalId });

        return {
          status: 'APPROVED' as const,
          positiveVotes,
          negativeVotes,
        };
      }

      if (totalVotes > 0 && negativeVotes / totalVotes > 0.5) {
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
