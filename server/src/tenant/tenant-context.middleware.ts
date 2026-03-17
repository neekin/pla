import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { TenantService } from './tenant.service';

const TENANT_HEADER = 'x-tenant-id';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(request: RequestWithUser, response: Response, next: NextFunction) {
    const headerTenant = request.headers[TENANT_HEADER] as string | undefined;
    const forwardedHost = request.headers['x-forwarded-host'] as string | undefined;
    const host = request.headers.host || request.hostname || '';
    const resolved = await this.tenantService.resolveByRequest({
      headerTenant,
      forwardedHost,
      host,
    });

    request.tenantId = resolved.tenantId;

    response.setHeader('x-tenant-id', request.tenantId);
    response.setHeader('x-tenant-source', resolved.source);
    next();
  }
}
