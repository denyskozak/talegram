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

import { normalizeTelegramUsername } from '../utils/telegram.js';

@Entity({ name: 'authors' })
export class Author {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'telegram_username', type: 'text', unique: true })
  telegramUsername!: string;

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
  normalizeUsername(): void {
    const normalized = normalizeTelegramUsername(this.telegramUsername);
    if (!normalized) {
      throw new Error('Invalid telegram username for author');
    }

    this.telegramUsername = normalized;
  }

  @BeforeInsert()
  @BeforeUpdate()
  trimName(): void {
    if (typeof this.name === 'string') {
      this.name = this.name.trim();
    }
  }
}
