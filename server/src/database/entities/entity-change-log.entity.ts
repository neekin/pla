import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('entity_change_logs')
@Index(['entityName', 'entityId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class EntityChangeLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  entityName: string;

  @Column({ type: 'varchar', length: 120 })
  entityId: string;

  @Column({ type: 'varchar', length: 20 })
  action: 'create' | 'update' | 'delete';

  @Column({ type: 'simple-json' })
  changes: Record<string, { before: unknown; after: unknown }>;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  actorUsername: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
