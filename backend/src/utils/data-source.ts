import { DataSource } from 'typeorm';
import { Author } from '../entities/Author.js';
import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';
import { Purchase } from '../entities/Purchase.js';
import { CommunityMember } from '../entities/CommunityMember.js';
import { AudioBook } from '../entities/AudioBook.js';
import { ProposalAudioBook } from '../entities/ProposalAudioBook.js';

const getDatabasePath = () => process.env.DATABASE_URL ?? 'database.sqlite';
const getNodeEnv = () => process.env.NODE_ENV;

export const appDataSource = new DataSource({
  type: 'sqlite',
  database: getDatabasePath(),
  entities: [Author, BookProposal, Book, ProposalVote, Purchase, CommunityMember, AudioBook, ProposalAudioBook],
  synchronize: true,
  logging: getNodeEnv() === 'development',
});

let initializePromise: Promise<DataSource> | null = null;

export async function initializeDataSource(): Promise<DataSource> {
  if (appDataSource.isInitialized) {
    return appDataSource;
  }

  if (!initializePromise) {
    initializePromise = appDataSource.initialize().catch((error: unknown) => {
      initializePromise = null;
      throw error;
    });
  }

  return initializePromise;
}
