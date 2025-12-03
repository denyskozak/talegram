import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { normalizeTelegramUserId } from '../utils/telegram.js';

@Entity({ name: 'authors' })
export class Author {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'telegram_user_id', type: 'text', unique: true })
  telegramUserId!: string;

  @Column({ name: 'payout_balance', type: 'integer', default: 0 })
  payoutBalance!: number;

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

  @BeforeInsert()
  @BeforeUpdate()
  normalizeUserId(): void {
    const normalized = normalizeTelegramUserId(this.telegramUserId);
    if (!normalized) {
      throw new Error('Invalid telegram user id for author');
    }

    this.telegramUserId = normalized;
  }

  @BeforeInsert()
  @BeforeUpdate()
  trimName(): void {
    if (typeof this.name === 'string') {
      this.name = this.name.trim();
    }
  }
}
