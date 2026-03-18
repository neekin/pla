import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AuditLogService } from './audit-log.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly metricsService: MetricsService,
  ) {}

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
        const status = response.statusCode;

        // Always record Prometheus metrics (including health checks)
        this.metricsService.recordRequest(request.method, path, status, durationMs);

        if (path.startsWith('/system/health') || path.startsWith('/system/metrics')) {
          return;
        }

        const record = {
          timestamp: new Date().toISOString(),
          method: request.method,
          path,
          statusCode: status,
          durationMs,
          tenantId: request.tenantId ?? 'host',
          username: request.user?.username ?? 'anonymous',
          userId: request.user?.userId ?? 'anonymous',
          ip: request.ip ?? 'unknown',
          reason: request.quotaContext?.reason,
        };

        this.auditLogService.addRecord(record);

        // Structured JSON log — correlate with requestId
        this.logger.log(
          JSON.stringify({
            requestId: request.requestId,
            method: record.method,
            path: record.path,
            status,
            durationMs,
            tenantId: record.tenantId,
            userId: record.userId,
          }),
        );
      }),
    );
  }
}
