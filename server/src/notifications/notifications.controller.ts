import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { concat, of } from 'rxjs';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { NotificationsService } from './notifications.service';

@Controller('system/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  @Permissions('dashboard:view')
  @Get()
  recent() {
    return {
      notifications: this.notificationsService.listRecent(20),
    };
  }

  @Public()
  @Sse('stream')
  stream(@Query('accessToken') accessToken?: string) {
    const user = this.validateToken(accessToken);

    if (!user.permissions.includes('dashboard:view')) {
      throw new ForbiddenException('功能权限不足');
    }

    return concat(
      of({
        type: 'snapshot',
        data: {
          notifications: this.notificationsService.listRecent(20),
        },
      }),
      this.notificationsService.stream(),
    );
  }

  private validateToken(accessToken?: string) {
    if (!accessToken) {
      throw new UnauthorizedException('缺少认证 Token');
    }

    try {
      return this.jwtService.verify<AuthUser>(accessToken, {
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      });
    } catch {
      throw new UnauthorizedException('Token 无效或已过期');
    }
  }
}
