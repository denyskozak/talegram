import type { Author, PublishedBook } from './types';
import { trpc } from '@/shared/api/trpc';

export async function fetchAuthors(): Promise<Author[]> {
  return trpc.authors.list.query();
}

export async function fetchMyPublishedBooks(): Promise<PublishedBook[]> {
  return trpc.authors.myPublishedBooks.query();
}
