import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { EntityChangeLogEntity } from '../database/entities/entity-change-log.entity';
import { ListEntityAuditsDto } from './dto/list-entity-audits.dto';

@Injectable()
export class EntityAuditService {
  constructor(
    @InjectRepository(EntityChangeLogEntity)
    private readonly entityChangeLogRepository: Repository<EntityChangeLogEntity>,
  ) {}

  async record(input: {
    entityName: string;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    changes: Record<string, { before: unknown; after: unknown }>;
    tenantId: string;
    actor?: AuthUser | { userId?: string; username?: string };
  }) {
    await this.entityChangeLogRepository.save(
      this.entityChangeLogRepository.create({
        entityName: input.entityName,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes,
        tenantId: input.tenantId,
        actorUserId: input.actor?.userId ?? null,
        actorUsername: input.actor?.username ?? null,
      }),
    );
  }

  async list(query: ListEntityAuditsDto) {
    const builder = this.entityChangeLogRepository.createQueryBuilder('log');

    if (query.entityName?.trim()) {
      builder.andWhere('log.entityName = :entityName', {
        entityName: query.entityName.trim(),
      });
    }

    if (query.actorUsername?.trim()) {
      builder.andWhere('log.actorUsername = :actorUsername', {
        actorUsername: query.actorUsername.trim(),
      });
    }

    if (query.action) {
      builder.andWhere('log.action = :action', {
        action: query.action,
      });
    }

    if (query.from) {
      builder.andWhere('log.createdAt >= :from', {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      builder.andWhere('log.createdAt <= :to', {
        to: new Date(query.to),
      });
    }

    const rows = await builder
      .orderBy('log.createdAt', 'DESC')
      .take(200)
      .getMany();

    return rows.map((row) => ({
      id: row.id,
      entityName: row.entityName,
      entityId: row.entityId,
      action: row.action,
      changes: row.changes,
      tenantId: row.tenantId,
      actorUserId: row.actorUserId,
      actorUsername: row.actorUsername,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
