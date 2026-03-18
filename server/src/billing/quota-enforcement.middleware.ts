import {
  HttpException,
  HttpStatus,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Response } from 'express';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { AuditLogService } from '../system/audit-log.service';
import { BillingService } from './billing.service';

@Injectable()
export class QuotaEnforcementMiddleware implements NestMiddleware {
  constructor(
    private readonly billingService: BillingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async use(request: RequestWithUser, response: Response, next: NextFunction) {
    const tenantId = request.tenantId ?? 'host';
    const capabilityPoint = 'task.dispatch';
    const evaluation = await this.billingService.evaluateQuota(
      tenantId,
      capabilityPoint,
    );

    if (!evaluation.exceeded) {
      next();
      return;
    }

    const reason = evaluation.reason ?? 'QUOTA_EXCEEDED';

    if (evaluation.strategy === 'degrade') {
      request.quotaContext = {
        capabilityPoint,
        strategy: 'degrade',
        reason,
      };
      response.setHeader('x-quota-overage', 'degrade');

      next();
      return;
    }

    this.auditLogService.addRecord({
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.originalUrl || request.url,
      statusCode: 429,
      durationMs: 0,
      tenantId,
      username: request.user?.username ?? 'anonymous',
      userId: request.user?.userId ?? 'anonymous',
      ip: request.ip ?? 'unknown',
      reason,
    });

    await this.billingService.recordQuotaEvent({
      tenantId,
      capabilityPoint,
      strategy: 'reject',
      reason,
      actor: request.user?.username ?? 'system-quota',
    });

    throw new HttpException(reason, HttpStatus.TOO_MANY_REQUESTS);
  }
}
