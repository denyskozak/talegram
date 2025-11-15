import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sortBooks } from "../bookSort.js";

type TestBook = {
  id: string;
  title: string;
  authors: string[];
  categories: string | null;
  coverUrl: string;
  description: string;
  rating: { average: number; votes: number };
  tags: string[];
  publishedAt?: string;
  reviewsCount: number;
};

const books: TestBook[] = [
  {
    id: "a",
    title: "A",
    authors: ["Author"],
    categories: "1",
    coverUrl: "",
    description: "",
    rating: { average: 4.5, votes: 100 },
    tags: [],
    publishedAt: "2023-01-01",
    reviewsCount: 200,
  },
  {
    id: "b",
    title: "B",
    authors: ["Author"],
    categories: "1",
    coverUrl: "",
    description: "",
    rating: { average: 4.8, votes: 50 },
    tags: [],
    publishedAt: "2024-01-01",
    reviewsCount: 150,
  },
  {
    id: "c",
    title: "C",
    authors: ["Author"],
    categories: "1",
    coverUrl: "",
    description: "",
    rating: { average: 4.8, votes: 90 },
    tags: [],
    publishedAt: "2022-01-01",
    reviewsCount: 400,
  },
];

describe("sortBooks", () => {
  it("sorts by popularity", () => {
    const result = sortBooks(books, "popular");
    assert.equal(result[0].id, "c");
  });

  it("sorts by rating and votes", () => {
    const result = sortBooks(books, "rating");
    assert.equal(result[0].id, "c");
  });

  it("sorts by new", () => {
    const result = sortBooks(books, "new");
    assert.equal(result[0].id, "b");
  });
});
