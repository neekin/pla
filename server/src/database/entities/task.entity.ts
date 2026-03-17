import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_tasks')
@Index(['status', 'runAt'])
@Index(['tenantId', 'createdAt'])
export class TaskEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  taskType: string;

  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  @Column()
  runAt: Date;

  @Column({ type: 'varchar', length: 20 })
  status: 'queued' | 'running' | 'done';

  @Column({ type: 'varchar', length: 80 })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}