import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const path = request.originalUrl || request.url;

        if (path.startsWith('/system/health')) {
          return;
        }

        this.auditLogService.addRecord({
          timestamp: new Date().toISOString(),
          method: request.method,
          path,
          statusCode: response.statusCode,
          durationMs,
          tenantId: request.tenantId ?? 'host',
          username: request.user?.username ?? 'anonymous',
          userId: request.user?.userId ?? 'anonymous',
          ip: request.ip ?? 'unknown',
          reason: request.quotaContext?.reason,
        });
      }),
    );
  }
}
