import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('workflow_runs')
@Index(['workflowKey', 'createdAt'])
@Index(['status', 'updatedAt'])
export class WorkflowRunEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  workflowKey: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'running' | 'done' | 'failed';

  @Column({ type: 'simple-json' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 80 })
  triggerBy: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
