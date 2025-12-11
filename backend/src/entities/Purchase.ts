import { randomUUID } from 'node:crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'purchases' })
@Index(['bookId', 'telegramUserId'], { unique: true })
export class Purchase {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'book_id', type: 'text' })
  bookId!: string;

  @Column({ name: 'telegram_user_id', type: 'text' })
  telegramUserId!: string;

  @Column({ name: 'payment_id', type: 'text' })
  paymentId!: string;

  @Column({ name: 'telegram_charge_id', type: 'text', nullable: true })
  telegramChargeId!: string | null;

  @Column({ name: 'purchased_at', type: 'datetime' })
  purchasedAt!: Date;

  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath!: string | null;

  @Column({ name: 'download_url', type: 'text', nullable: true })
  downloadUrl!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = randomUUID();
    }

    if (!this.purchasedAt) {
      this.purchasedAt = new Date();
    }
  }
}
