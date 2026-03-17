import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../../common/constants/permission.constant';
import { Role } from '../../common/enums/role.enum';
import { RequestWithUser } from '../../common/types/request-with-user.type';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('缺少认证 Token');
    }

    let payload: AuthUser;

    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      });
    } catch {
      throw new UnauthorizedException('Token 无效或已过期');
    }

    if (request.tenantId && payload.tenantId !== request.tenantId) {
      throw new ForbiddenException('租户上下文不匹配');
    }

    request.user = payload;

    if (requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((role) => payload.roles.includes(role));

      if (!hasRole) {
        throw new ForbiddenException('角色权限不足');
      }
    }

    if (requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((permission) =>
        payload.permissions.includes(permission),
      );

      if (!hasAllPermissions) {
        throw new ForbiddenException('功能权限不足');
      }
    }

    return true;
  }

  private extractBearerToken(authHeader?: string) {
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
