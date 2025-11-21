import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getBook, listAllBooks } from '../data/catalog.js';
import { createRouter, procedure } from '../trpc/trpc.js';
import { issueAdminToken, validateAdminCredentials, verifyAdminToken } from '../services/adminAuth.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { Author } from '../entities/Author.js';
import { WalrusFileRecord } from '../entities/WalrusFileRecord.js';
import { CommunityMember } from '../entities/CommunityMember.js';

function extractBearerToken(rawHeader: string | string[] | undefined): string | null {
  if (!rawHeader) {
    return null;
  }

  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

const adminProcedure = procedure.use(({ ctx, next }) => {
  const token = extractBearerToken(ctx.req.headers['authorization']);
  if (!verifyAdminToken(token)) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid admin credentials' });
  }

  return next();
});

const ratingSchema = z.object({
  average: z.number().min(0).max(5),
  votes: z.number().int().min(0),
});

const communityMemberBaseSchema = z.object({
  telegramUserId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.trim()),
  fullName: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .transform((value) => value.trim()),
});

const communityMemberRankSchema = z.number().int().min(1).max(1000);

const baseBookSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  authors: z.array(z.string().trim().min(1)).min(1),
  categories: z.string().trim().min(1),
  coverUrl: z.string().trim().url(),
  description: z.string().trim().min(1),
  priceStars: z.number().int().min(0).max(10),
  rating: ratingSchema,
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  publishedAt: z.string().trim().datetime({ offset: true }).optional(),
  reviewsCount: z.number().int().min(0).optional(),
});

const loginInput = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const createAuthorInput = z.object({
  name: z.string().trim().min(1).max(128),
  telegramUsername: z.string().trim().min(3).max(32),
});

const getBookInput = z.object({
  id: z.string().trim().min(1),
});

const updateBookInput = z.object({
  id: z.string().trim().min(1),
  patch: baseBookSchema.omit({ id: true }).partial(),
});

const deleteBookInput = z.object({
  id: z.string().trim().min(1),
});

const createCommunityMemberInput = communityMemberBaseSchema.extend({
  rank: communityMemberRankSchema.optional().default(1),
});

const communityMemberUpdateFieldsSchema = communityMemberBaseSchema.extend({
  rank: communityMemberRankSchema,
});

const updateCommunityMemberInput = z.object({
  id: z.number().int().positive(),
  patch: communityMemberUpdateFieldsSchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided to update a community member.',
  }),
});

const deleteCommunityMemberInput = z.object({
  id: z.number().int().positive(),
});

const ONE_MONTH_SECONDS = 30 * 24 * 60 * 60;

export const adminRouter = createRouter({
  login: procedure.input(loginInput).mutation(({ input }) => {
    const { username, password } = input;
    if (!validateAdminCredentials(username, password)) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid admin credentials' });
    }

    const { token, expiresAt } = issueAdminToken();

    return { token, expiresAt: expiresAt.toISOString() } as const;
  }),
  listAuthors: adminProcedure.query(async () => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Author);
    const authors = await repository.find({ order: { name: 'ASC' } });

    return authors.map((author) => ({
      id: author.id,
      name: author.name,
      telegramUsername: author.telegramUsername,
    }));
  }),
  createAuthor: adminProcedure.input(createAuthorInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Author);

    try {
      const author = repository.create({
        name: input.name,
        telegramUsername: input.telegramUsername,
      });
      const saved = await repository.save(author);

      return {
        id: saved.id,
        name: saved.name,
        telegramUsername: saved.telegramUsername,
      } as const;
    } catch (error) {
      console.error('Failed to create author', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Failed to create author. Please ensure the username is unique and valid.',
      });
    }
  }),
  listBooks: adminProcedure.query(() => listAllBooks()),
  getBook: adminProcedure.input(getBookInput).query(async ({ input }) => {
    const book = await getBook(input.id);
    if (!book) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    return book;
  }),
  updateBook: adminProcedure.input(updateBookInput).mutation(() => {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Manual book management is disabled for the database-backed catalog.',
    });
  }),
  deleteBook: adminProcedure.input(deleteBookInput).mutation(() => {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Manual book management is disabled for the database-backed catalog.',
    });
  }),
  listCommunityMembers: adminProcedure.query(async () => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(CommunityMember);

    const members = await repository.find({ order: { rank: 'ASC', id: 'ASC' } });

    return members.map((member) => ({
      id: member.id,
      telegramUserId: member.telegramUserId,
      fullName: member.fullName,
      rank: member.rank,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    }));
  }),
  createCommunityMember: adminProcedure.input(createCommunityMemberInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(CommunityMember);

    try {
      const toCreate = repository.create({
        telegramUserId: input.telegramUserId,
        fullName: input.fullName,
        rank: input.rank ?? 1,
      });
      const saved = await repository.save(toCreate);

      return {
        id: saved.id,
        telegramUserId: saved.telegramUserId,
        fullName: saved.fullName,
        rank: saved.rank,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      } as const;
    } catch (error) {
      console.error('Failed to create community member', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unable to create community member. Please ensure the Telegram ID is unique.',
      });
    }
  }),
  updateCommunityMember: adminProcedure.input(updateCommunityMemberInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(CommunityMember);

    const member = await repository.findOne({ where: { id: input.id } });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Community member not found' });
    }

    if (input.patch.telegramUserId !== undefined) {
      member.telegramUserId = input.patch.telegramUserId;
    }
    if (input.patch.fullName !== undefined) {
      member.fullName = input.patch.fullName;
    }
    if (input.patch.rank !== undefined) {
      member.rank = input.patch.rank;
    }

    try {
      const saved = await repository.save(member);
      return {
        id: saved.id,
        telegramUserId: saved.telegramUserId,
        fullName: saved.fullName,
        rank: saved.rank,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      } as const;
    } catch (error) {
      console.error('Failed to update community member', error);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Unable to update community member. Please ensure the Telegram ID is unique.',
      });
    }
  }),
  deleteCommunityMember: adminProcedure.input(deleteCommunityMemberInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(CommunityMember);

    const member = await repository.findOne({ where: { id: input.id } });
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Community member not found' });
    }

    await repository.remove(member);

    return { success: true } as const;
  }),
  refreshWalrusFiles: adminProcedure.mutation(async () => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(WalrusFileRecord);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const thresholdSeconds = nowSeconds + ONE_MONTH_SECONDS;
    const expiring = await repository
      .createQueryBuilder('wf')
      .where('wf.expiresDate <= :threshold', { threshold: thresholdSeconds })
      .orderBy('wf.expiresDate', 'ASC')
      .getMany();

    const expiringFiles = expiring.map((record) => ({
      warlusFileId: record.warlusFileId,
      expiresDate: record.expiresDate,
      expiresInSeconds: record.expiresDate - nowSeconds,
    }));

    return {
      expiringFiles,
      count: expiringFiles.length,
      checkedAt: new Date(nowSeconds * 1000).toISOString(),
    } as const;
  }),
});

