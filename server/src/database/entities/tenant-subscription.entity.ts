import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

const DB_DATE_COLUMN_TYPE =
  (process.env.DB_TYPE ?? 'postgres').toLowerCase() === 'postgres'
    ? 'timestamp'
    : 'datetime';

@Entity('tenant_subscriptions')
@Index(['tenantId'], { unique: true })
@Index(['status', 'updatedAt'])
export class TenantSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 40 })
  editionId: string;

  @Column({ type: 'varchar', length: 40 })
  plan: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'trialing' | 'active' | 'expired';

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true, default: null })
  trialStartAt: Date | null;

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true, default: null })
  trialEndAt: Date | null;

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true, default: null })
  currentPeriodStartAt: Date | null;

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true, default: null })
  currentPeriodEndAt: Date | null;

  @Column({ type: 'simple-json' })
  quota: Record<string, number>;

  @Column({ type: 'simple-json' })
  usage: Record<string, number>;

  @Column({ type: 'varchar', length: 80, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
