import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

const DB_DATE_COLUMN_TYPE =
  (process.env.DB_TYPE ?? 'postgres').toLowerCase() === 'postgres'
    ? 'timestamp'
    : 'datetime';

@Entity('platform_users')
@Index(['tenantId', 'username'], { unique: true })
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 80 })
  username: string;

  @Column({ type: 'varchar', length: 120 })
  password: string;

  @Column({ type: 'simple-json' })
  roles: string[];

  @Column({ type: 'simple-json' })
  permissions: string[];

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true, default: null })
  lockedUntil: Date | null;

  @Column({ type: 'boolean', default: false })
  requiresPasswordReset: boolean;

  @Column({ type: DB_DATE_COLUMN_TYPE, nullable: true, default: null })
  passwordResetAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
