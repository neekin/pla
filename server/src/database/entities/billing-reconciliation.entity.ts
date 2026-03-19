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

@Entity('billing_reconciliations')
@Index(['tenantId', 'createdAt'])
@Index(['status', 'updatedAt'])
export class BillingReconciliationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: DB_DATE_COLUMN_TYPE })
  periodStart: Date;

  @Column({ type: DB_DATE_COLUMN_TYPE })
  periodEnd: Date;

  @Column({ type: 'varchar', length: 24 })
  status: 'matched' | 'needs_compensation';

  @Column({ type: 'simple-json' })
  summary: Record<string, number>;

  @Column({ type: 'simple-json' })
  anomalies: Array<Record<string, unknown>>;

  @Column({ type: 'simple-json' })
  suggestions: string[];

  @Column({ type: 'varchar', length: 80, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}