import type { Author } from './types';
import { trpc } from '@/shared/api/trpc';

export async function fetchAuthors(): Promise<Author[]> {
  return trpc.authors.list.query();
}
