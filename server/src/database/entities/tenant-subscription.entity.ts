import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'timestamp', nullable: true, default: null })
  trialStartAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  trialEndAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  currentPeriodStartAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
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
