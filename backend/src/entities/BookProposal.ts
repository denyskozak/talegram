import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Book } from './Book.js';
import { ProposalVote } from './ProposalVote.js';

export enum ProposalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity({ name: 'book_proposals' })
export class BookProposal {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  author!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ name: 'walrus_file_id', type: 'text' })
  walrusFileId!: string;

  @Column({ name: 'walrus_blob_id', type: 'text' })
  walrusBlobId!: string;

  @Column({ name: 'walrus_blob_url', type: 'text', nullable: true })
  walrusBlobUrl!: string | null;

  @Column({ name: 'cover_walrus_file_id', type: 'text', nullable: true })
  coverWalrusFileId!: string | null;

  @Column({ name: 'cover_walrus_blob_id', type: 'text', nullable: true })
  coverWalrusBlobId!: string | null;

  @Column({ name: 'cover_walrus_blob_url', type: 'text', nullable: true })
  coverWalrusBlobUrl!: string | null;

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

  @Column({ type: 'text', default: ProposalStatus.PENDING })
  status!: ProposalStatus;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => Book, (book: Book) => book.proposal)
  books!: Book[];

  @OneToMany(() => ProposalVote, (vote: ProposalVote) => vote.proposal)
  votes!: ProposalVote[];

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
