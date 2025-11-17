import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'warlus_files' })
export class WalrusFileRecord {
  @PrimaryColumn({ name: 'warlus_file_id', type: 'text' })
  warlusFileId!: string;

  @Column({ name: 'expires_date', type: 'integer' })
  expiresDate!: number;
}
