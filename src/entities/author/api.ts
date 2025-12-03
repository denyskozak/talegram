import type { Author, PublishedBook, PublishedBookDetails } from './types';
import { trpc } from '@/shared/api/trpc';

export async function fetchAuthors(): Promise<Author[]> {
  return trpc.authors.list.query();
}

export async function fetchMyPublishedBooks(): Promise<PublishedBook[]> {
  return trpc.authors.myPublishedBooks.query();
}

export async function fetchPublishedBook(bookId: string): Promise<PublishedBookDetails> {
  return trpc.authors.myPublishedBook.query({ id: bookId });
}
