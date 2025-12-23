import {randomUUID} from 'node:crypto';
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
import { AudioBook } from './AudioBook.js';

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

@Entity({name: 'books'})
export class Book {
    @PrimaryColumn({type: 'text'})
    id!: string;

    @Column({type: 'text'})
    title!: string;

    @Column({type: 'text'})
    author!: string;

    @Column({type: 'text'})
    description!: string;

    @Column({name: 'file_path', type: 'text'})
    filePath!: string;

    @Column({name: 'audiobook_file_path', type: 'text', nullable: true})
    audiobookFilePath!: string | null;

    @Column({name: 'cover_file_path', type: 'text', nullable: true})
    coverFilePath!: string | null;

    @Column({name: 'cover_mime_type', type: 'text', nullable: true})
    coverMimeType!: string | null;

    @Column({name: 'cover_file_name', type: 'text', nullable: true})
    coverFileName!: string | null;

    @Column({name: 'cover_file_size', type: 'integer', nullable: true})
    coverFileSize!: number | null;

    @Column({name: 'cover_url', type: 'text', nullable: true})
    coverUrl!: string | null;

    @Column({name: 'mime_type', type: 'text', nullable: true})
    mimeType!: string | null;

    @Column({name: 'file_name', type: 'text'})
    fileName!: string;

    @Column({name: 'file_size', type: 'integer', nullable: true})
    fileSize!: number | null;

    @Column({name: 'audiobook_mime_type', type: 'text', nullable: true})
    audiobookMimeType!: string | null;

    @Column({name: 'audiobook_file_name', type: 'text', nullable: true})
    audiobookFileName!: string | null;

    @Column({name: 'audiobook_file_size', type: 'integer', nullable: true})
    audiobookFileSize!: number | null;

    @Column({name: 'proposal_id', type: 'text', nullable: true})
    proposalId!: string | null;

    @Column({name: 'category', type: 'text', nullable: true})
    category!: string | null;

    @Column({
        name: 'tags',
        type: 'text',
        transformer: stringArrayTransformer,
        default: '[]',
    })
    tags!: string[];

    @Column({
        name: 'similar_books',
        type: 'text',
        transformer: stringArrayTransformer,
        default: '[]',
    })
    similarBooks!: string[];

    @Column({name: 'global_category', type: 'text', nullable: true})
    globalCategory!: string | null;

    @Column({name: 'price', type: 'integer', default: 0})
    price!: number;

    @Column({type: 'text', default: 'stars'})
    currency!: string;

    @Column({name: 'rating_average', type: 'real', default: 0})
    ratingAverage!: number;

    @Column({name: 'rating_votes', type: 'integer', default: 0})
    ratingVotes!: number;

    @Column({name: 'middle_rate', type: 'real', default: 0})
    middleRate!: number;

    @Column({name: 'reviews_count', type: 'integer', default: 0})
    reviewsCount!: number;

    @Column({name: 'published_at', type: 'datetime', nullable: true})
    publishedAt!: Date | null;

    @Column({name: 'author_telegram_user_id', type: 'text', nullable: true})
    authorTelegramUserId!: string | null;

    @Column({name: 'language', type: 'text', nullable: true})
    language!: string | null;

    @CreateDateColumn({name: 'created_at', type: 'datetime'})
    createdAt!: Date;

    @UpdateDateColumn({name: 'updated_at', type: 'datetime'})
    updatedAt!: Date;

    @OneToMany(() => AudioBook, (audioBook: AudioBook) => audioBook.book)
    audioBooks?: AudioBook[];

    @BeforeInsert()
    ensureId(): void {
        if (!this.id) {
            this.id = randomUUID();
        }
    }
}
