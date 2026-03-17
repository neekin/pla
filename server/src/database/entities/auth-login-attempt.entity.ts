import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('auth_login_attempts')
@Index(['tenantId', 'username', 'attemptedAt'])
export class AuthLoginAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 80 })
  username: string;

  @Column({ type: 'boolean' })
  success: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  attemptedAt: Date;
}
