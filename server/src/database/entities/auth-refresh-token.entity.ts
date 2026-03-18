import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('auth_refresh_tokens')
@Index(['tokenHash'], { unique: true })
@Index(['tenantId', 'userId'])
export class AuthRefreshTokenEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ type: 'varchar', length: 64 })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  tenantId: string;

  @Column({ type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  replacedByTokenId: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  createdByIp: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
