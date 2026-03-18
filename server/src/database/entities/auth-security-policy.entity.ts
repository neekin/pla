import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('auth_security_policies')
@Index(['scopeType', 'scopeId'], { unique: true })
export class AuthSecurityPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, default: 'host' })
  scopeType: 'host';

  @Column({ type: 'varchar', length: 80, default: 'host' })
  scopeId: string;

  @Column({ type: 'int', default: 5 })
  maxFailedAttempts: number;

  @Column({ type: 'int', default: 15 })
  lockoutMinutes: number;

  @Column({ type: 'int', default: 6 })
  minPasswordLength: number;

  @Column({ type: 'boolean', default: false })
  requireUppercase: boolean;

  @Column({ type: 'boolean', default: false })
  requireLowercase: boolean;

  @Column({ type: 'boolean', default: false })
  requireNumbers: boolean;

  @Column({ type: 'boolean', default: false })
  requireSymbols: boolean;

  @Column({ type: 'boolean', default: false })
  forcePasswordResetOnFirstLogin: boolean;

  @Column({ type: 'boolean', default: false })
  rejectWeakPasswordOnLogin: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
