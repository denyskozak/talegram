import { Buffer } from 'node:buffer';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createRouter, procedure } from '../trpc/trpc.js';
import { prisma } from '../utils/prisma.js';
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
    const proposals = await prisma.bookProposal.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return proposals;
  }),
  listForVoting: procedure.input(listForVotingInput).query(async ({ input }) => {
    assertAllowedTelegramVoter(input.telegramUserId);

    const proposals = await prisma.bookProposal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { votes: true },
    });

    const normalized = proposals.map((proposal: (typeof proposals)[number]) => {
      const { votes, ...rest } = proposal;
      const positiveVotes = votes.filter((vote: (typeof votes)[number]) => vote.isPositive).length;
      const negativeVotes = votes.length - positiveVotes;
      const userVote = votes.find(
        (vote: (typeof votes)[number]) => vote.telegramUserId === input.telegramUserId,
      );

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

    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.bookProposal.findUnique({ where: { id: input.proposalId } });
      if (!proposal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' });
      }

      await tx.proposalVote.upsert({
        where: {
          proposalId_telegramUserId: {
            proposalId: input.proposalId,
            telegramUserId: input.telegramUserId,
          },
        },
        create: {
          proposalId: input.proposalId,
          telegramUserId: input.telegramUserId,
          isPositive: input.isPositive,
        },
        update: {
          isPositive: input.isPositive,
        },
      });

      const groupedVotes = await tx.proposalVote.groupBy({
        by: ['isPositive'],
        where: { proposalId: input.proposalId },
        _count: { _all: true },
      });

      let positiveVotes = 0;
      let negativeVotes = 0;
      for (const group of groupedVotes) {
        if (group.isPositive) {
          positiveVotes = group._count._all;
        } else {
          negativeVotes = group._count._all;
        }
      }

      const totalVotes = positiveVotes + negativeVotes;
      if (totalVotes > 0 && positiveVotes / totalVotes > 0.5) {
        await tx.book.create({
          data: {
            title: proposal.title,
            author: proposal.author,
            description: proposal.description,
            walrusBlobId: proposal.walrusBlobId,
            walrusBlobUrl: proposal.walrusBlobUrl,
            coverWalrusBlobId: proposal.coverWalrusBlobId ?? undefined,
            coverWalrusBlobUrl: proposal.coverWalrusBlobUrl ?? undefined,
            coverMimeType: proposal.coverMimeType ?? undefined,
            coverFileName: proposal.coverFileName ?? undefined,
            coverFileSize: proposal.coverFileSize ?? undefined,
            mimeType: proposal.mimeType,
            fileName: proposal.fileName,
            fileSize: proposal.fileSize,
          },
        });
        await tx.proposalVote.deleteMany({ where: { proposalId: input.proposalId } });
        await tx.bookProposal.delete({ where: { id: input.proposalId } });

        return {
          status: 'APPROVED' as const,
          positiveVotes,
          negativeVotes,
        };
      }

      if (totalVotes > 0 && negativeVotes / totalVotes > 0.5) {
        await tx.proposalVote.deleteMany({ where: { proposalId: input.proposalId } });
        await tx.bookProposal.delete({ where: { id: input.proposalId } });

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
