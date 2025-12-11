import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getBook, listAllBooks } from '../data/catalog.js';
import { createRouter, procedure } from '../trpc/trpc.js';
import { issueAdminToken, validateAdminCredentials, verifyAdminToken } from '../services/adminAuth.js';
import { initializeDataSource, appDataSource } from '../utils/data-source.js';
import { Author } from '../entities/Author.js';
import { Book } from '../entities/Book.js';
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
  coverUrl: z.string().trim().url().optional().default(''),
  description: z.string().trim().min(1),
  price: z.number().int().min(0),
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
  telegramUserId: z.string().trim().min(1).max(64),
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
      telegramUserId: author.telegramUserId,
    }));
  }),
  createAuthor: adminProcedure.input(createAuthorInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Author);

    try {
      const author = repository.create({
        name: input.name,
        telegramUserId: input.telegramUserId,
      });
      const saved = await repository.save(author);

      return {
        id: saved.id,
        name: saved.name,
        telegramUserId: saved.telegramUserId,
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
  updateBook: adminProcedure.input(updateBookInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Book);

    const entity = await repository.findOne({ where: { id: input.id } });
    if (!entity) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    const { patch } = input;

    if (patch.title !== undefined) {
      entity.title = patch.title;
    }
    if (patch.authors !== undefined) {
      entity.author = patch.authors.join(', ');
    }
    if (patch.categories !== undefined) {
      entity.category = patch.categories;
    }
    if (patch.coverUrl !== undefined) {
      entity.coverUrl = patch.coverUrl;
    }
    if (patch.description !== undefined) {
      entity.description = patch.description;
    }
    if (patch.price !== undefined) {
      entity.price = patch.price;
    }
    if (patch.tags !== undefined) {
      entity.tags = patch.tags;
    }
    if (patch.publishedAt !== undefined) {
      entity.publishedAt = patch.publishedAt ? new Date(patch.publishedAt) : null;
    }
    if (patch.reviewsCount !== undefined) {
      entity.reviewsCount = patch.reviewsCount;
    }
    if (patch.rating) {
      if (patch.rating.average !== undefined) {
        entity.ratingAverage = patch.rating.average;
        entity.middleRate = patch.rating.average;
      }
      if (patch.rating.votes !== undefined) {
        entity.ratingVotes = patch.rating.votes;
      }
    }

    const saved = await repository.save(entity);
    return getBook(saved.id);
  }),
  deleteBook: adminProcedure.input(deleteBookInput).mutation(async ({ input }) => {
    await initializeDataSource();
    const repository = appDataSource.getRepository(Book);

    const entity = await repository.findOne({ where: { id: input.id } });
    if (!entity) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Book not found' });
    }

    await repository.remove(entity);

    return { success: true } as const;
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
});

