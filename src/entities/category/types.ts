import type { ID } from "@/entities/book/types";

export type Category = {
  id: ID;
  title: string;
  slug: string;
  emoji?: string;
  booksCount?: number;
};
