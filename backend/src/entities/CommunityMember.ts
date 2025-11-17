import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'community_members' })
export class CommunityMember {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ name: 'telegram_user_id', type: 'text', unique: true })
  telegramUserId!: string;

  @Column({ type: 'integer', default: 1 })
  rank!: number;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
