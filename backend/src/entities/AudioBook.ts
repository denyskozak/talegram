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
import { Book } from './Book.js';

@Entity({ name: 'audio_books' })
export class AudioBook {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'book_id', type: 'text' })
  bookId!: string;

  @ManyToOne(() => Book, (book: Book) => book.audioBooks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book?: Book;

  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ name: 'file_path', type: 'text' })
  filePath!: string;

  @Column({ name: 'mime_type', type: 'text', nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_name', type: 'text', nullable: true })
  fileName!: string | null;

  @Column({ name: 'file_size', type: 'integer', nullable: true })
  fileSize!: number | null;

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
