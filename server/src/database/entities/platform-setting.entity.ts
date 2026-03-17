import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SettingScopeType = 'host' | 'tenant' | 'user';

@Entity('platform_settings')
@Index(['scopeType', 'scopeId', 'key'], { unique: true })
export class PlatformSettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  scopeType: SettingScopeType;

  @Column({ type: 'varchar', length: 80 })
  scopeId: string;

  @Column({ type: 'varchar', length: 120 })
  key: string;

  @Column({ type: 'simple-json' })
  value: unknown;

  @Column({ type: 'varchar', length: 80, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
