import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('workflow_step_runs')
@Index(['runId', 'stepKey'])
@Index(['status', 'createdAt'])
export class WorkflowStepRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  runId: string;

  @Column({ type: 'varchar', length: 120 })
  stepKey: string;

  @Column({ type: 'varchar', length: 20 })
  status: 'done' | 'failed' | 'compensated';

  @Column({ type: 'int' })
  attempts: number;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  stepContext: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
