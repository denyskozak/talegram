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
} from 'typeorm';
import { BookProposal } from './BookProposal.js';

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

  @Column({ name: 'walrus_blob_url', type: 'text' })
  walrusBlobUrl!: string;

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

  @Column({ name: 'proposal_id', type: 'text', nullable: true })
  proposalId!: string | null;

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
