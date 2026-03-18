import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, mergeMap } from 'rxjs';
import type { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { EntityAuditService } from '../../system/entity-audit.service';
import { ENTITY_AUDIT_META_KEY, type EntityAuditMeta } from '../decorators/entity-audit.decorator';
import type { RequestWithUser } from '../types/request-with-user.type';

interface EntityAuditPayload {
  entityId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  tenantId?: string;
  action?: 'create' | 'update' | 'delete';
  actor?: AuthUser;
}

@Injectable()
export class EntityAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly entityAuditService: EntityAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const meta = this.reflector.getAllAndOverride<EntityAuditMeta | undefined>(
      ENTITY_AUDIT_META_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const payloadKey = meta.payloadKey ?? '__entityAudit';

    return next.handle().pipe(
      mergeMap((response) =>
        from(this.recordAndSanitize(meta, payloadKey, response, request)),
      ),
    );
  }

  private async recordAndSanitize(
    meta: EntityAuditMeta,
    payloadKey: string,
    response: unknown,
    request: RequestWithUser,
  ) {
    if (!response || typeof response !== 'object') {
      return response;
    }

    const objectResponse = response as Record<string, unknown>;
    const payload = objectResponse[payloadKey] as EntityAuditPayload | undefined;

    if (!payload) {
      return response;
    }

    const changes = payload.changes ?? {};
    if (Object.keys(changes).length > 0) {
      await this.entityAuditService.record({
        entityName: meta.entityName,
        entityId: payload.entityId,
        action: payload.action ?? meta.action,
        changes,
        tenantId: payload.tenantId ?? request.user?.tenantId ?? request.tenantId ?? 'host',
        actor: payload.actor ?? request.user,
      });
    }

    const sanitized = { ...objectResponse };
    delete sanitized[payloadKey];
    return sanitized;
  }
}
