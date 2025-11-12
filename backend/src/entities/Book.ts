import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type ValueTransformer,
} from 'typeorm';
import { BookProposal } from './BookProposal.js';

const stringArrayTransformer: ValueTransformer = {
  to(value: string[] | null): string {
    if (!Array.isArray(value) || value.length === 0) {
      return '[]';
    }

    const normalized = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);

    return JSON.stringify(normalized);
  },
  from(value: unknown): string[] {
    if (typeof value !== 'string' || value.length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0);
      }
    } catch (error) {
      // Ignore malformed JSON and fall back to an empty list
    }

    return [];
  },
};

@Entity({ name: 'books' })
export class Book {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  author!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'walrus_blob_id', type: 'text' })
  walrusBlobId!: string;

  @Column({ name: 'cover_walrus_blob_id', type: 'text', nullable: true })
  coverWalrusBlobId!: string | null;

  @Column({ name: 'cover_mime_type', type: 'text', nullable: true })
  coverMimeType!: string | null;

  @Column({ name: 'cover_file_name', type: 'text', nullable: true })
  coverFileName!: string | null;

  @Column({ name: 'cover_file_size', type: 'integer', nullable: true })
  coverFileSize!: number | null;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_name', type: 'text' })
  fileName!: string;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize!: number | null;

  @Column({ name: 'file_encryption_iv', type: 'text', nullable: true })
  fileEncryptionIv!: string | null;

  @Column({ name: 'file_encryption_tag', type: 'text', nullable: true })
  fileEncryptionTag!: string | null;

  @Column({ name: 'proposal_id', type: 'text', nullable: true })
  proposalId!: string | null;

  @Column({
    name: 'categories',
    type: 'text',
    transformer: stringArrayTransformer,
    default: '[]',
  })
  categories!: string[];

  @Column({
    name: 'tags',
    type: 'text',
    transformer: stringArrayTransformer,
    default: '[]',
  })
  tags!: string[];

  @Column({ name: 'price_stars', type: 'integer', default: 0 })
  priceStars!: number;

  @Column({ name: 'rating_average', type: 'real', default: 0 })
  ratingAverage!: number;

  @Column({ name: 'rating_votes', type: 'integer', default: 0 })
  ratingVotes!: number;

  @Column({ name: 'reviews_count', type: 'integer', default: 0 })
  reviewsCount!: number;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @ManyToOne(() => BookProposal, (proposal: BookProposal) => proposal.books, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'proposal_id' })
  proposal!: BookProposal | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
