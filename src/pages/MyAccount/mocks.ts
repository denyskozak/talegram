import type { MyBook } from "./types";

export const mockBooks: MyBook[] = [
  {
    id: "ton-collectible-01",
    title: "The Blockchain Explorer",
    author: "Eva Anton",
    cover: "/images/books/b1.jpg",
    collection: "Talegram Originals",
    tokenId: "#1245",
    status: "owned",
  },
  {
    id: "ton-collectible-02",
    title: "Waves of the Ton",
    author: "Ilya Mirov",
    cover: "/images/books/b3.jpg",
    collection: "Indie Shelf",
    tokenId: "#0981",
    status: "listed",
  },
  {
    id: "ton-collectible-03",
    title: "Encrypted Tales",
    author: "Sara Kim",
    cover: "/images/books/b7.jpg",
    collection: "Limited Drops",
    tokenId: "#2210",
    status: "owned",
  },
];
