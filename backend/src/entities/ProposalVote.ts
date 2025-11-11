import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { BookProposal } from './BookProposal.js';

@Entity({ name: 'proposal_votes' })
@Index(['proposalId', 'telegramUsername'], { unique: true })
export class ProposalVote {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'proposal_id', type: 'text' })
  proposalId!: string;

  @ManyToOne(() => BookProposal, (proposal: BookProposal) => proposal.votes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'proposal_id' })
  proposal!: BookProposal;

  @Column({ name: 'telegram_username', type: 'text' })
  telegramUsername!: string;

  @Column({ name: 'is_positive', type: 'boolean' })
  isPositive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = randomUUID();
    }
  }
}
