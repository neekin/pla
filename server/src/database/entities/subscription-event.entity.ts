import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('subscription_events')
@Index(['tenantId', 'createdAt'])
export class SubscriptionEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 40 })
  eventType: string;

  @Column({ type: 'simple-json' })
  detail: Record<string, unknown>;

  @Column({ type: 'varchar', length: 80, nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
