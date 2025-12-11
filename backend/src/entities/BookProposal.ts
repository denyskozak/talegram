import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
  type ValueTransformer,
} from 'typeorm';
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

  @Column({ name: 'global_category', type: 'text' })
  globalCategory!: string;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'integer', default: 0 })
  price!: number;

  @Column({ type: 'text', default: 'stars' })
  currency!: string;

  @Column({
    type: 'text',
    transformer: {
      to(value: string[] | null): string {
        const items = Array.isArray(value) ? value : [];
        return JSON.stringify(items);
      },
      from(value: string | null): string[] {
        if (typeof value !== 'string' || value.length === 0) {
          return [];
        }

        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed
              .filter((item) => typeof item === 'string')
              .map((item) => item.trim())
              .filter((item) => item.length > 0);
          }
        } catch (error) {
          // Ignore malformed JSON and fall back to an empty list
        }

        return [];
      },
    } satisfies ValueTransformer,
  })
  hashtags!: string[];

  @Column({ name: 'file_path', type: 'text' })
  filePath!: string;

  @Column({ name: 'audiobook_file_path', type: 'text', nullable: true })
  audiobookFilePath!: string | null;

  @Column({ name: 'audiobook_mime_type', type: 'text', nullable: true })
  audiobookMimeType!: string | null;

  @Column({ name: 'audiobook_file_name', type: 'text', nullable: true })
  audiobookFileName!: string | null;

  @Column({ name: 'audiobook_file_size', type: 'integer', nullable: true })
  audiobookFileSize!: number | null;

  @Column({ name: 'cover_file_path', type: 'text', nullable: true })
  coverFilePath!: string | null;

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

  @Column({ name: 'submitted_by_telegram_username', type: 'text', nullable: true })
  submittedByTelegramUsername!: string | null;

  @Column({ name: 'submitted_by_telegram_user_id', type: 'text', nullable: true })
  submittedByTelegramUserId!: string | null;

  @Column({ name: 'language', type: 'text', nullable: true })
  language!: string | null;

  @Column({ type: 'text', default: ProposalStatus.PENDING })
  status!: ProposalStatus;

  @Column({ name: 'reviewer_notes', type: 'text', nullable: true })
  reviewerNotes!: string | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => ProposalVote, (vote: ProposalVote) => vote.proposal)
  votes!: ProposalVote[];

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
