import { DataSource } from 'typeorm';
import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';

const databasePath = process.env.DATABASE_URL ?? 'database.sqlite';

export const appDataSource = new DataSource({
  type: 'sqlite',
  database: databasePath,
  entities: [BookProposal, Book, ProposalVote],
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
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
