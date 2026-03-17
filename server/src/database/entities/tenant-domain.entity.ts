import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const DB_DATE_COLUMN_TYPE =
  (process.env.DB_TYPE ?? 'postgres').toLowerCase() === 'postgres'
    ? 'timestamp'
    : 'datetime';

@Entity('tenant_domains')
@Index(['domain'], { unique: true })
export class TenantDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  domain: string;

  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'varchar', length: 128 })
  verificationToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true })
  verifiedAt: Date | null;
}
