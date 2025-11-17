import { DataSource } from 'typeorm';
import { Author } from '../entities/Author.js';
import { Book } from '../entities/Book.js';
import { BookProposal } from '../entities/BookProposal.js';
import { ProposalVote } from '../entities/ProposalVote.js';
import { Purchase } from '../entities/Purchase.js';
import { WalrusFileRecord } from '../entities/WalrusFileRecord.js';
import { CommunityMember } from '../entities/CommunityMember.js';

const databasePath = process.env.DATABASE_URL ?? 'database.sqlite';

console.log("databasePath: ", databasePath);
export const appDataSource = new DataSource({
  type: 'sqlite',
  database: databasePath,
  entities: [Author, BookProposal, Book, ProposalVote, Purchase, WalrusFileRecord, CommunityMember],
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
