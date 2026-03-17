import { Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';

@Injectable()
export class IamService {
  constructor(private readonly authService: AuthService) {}

  listUsers() {
    return this.authService.listUsers();
  }

  permissionCatalog() {
    return [
      'dashboard:view',
      'task:read',
      'task:dispatch',
      'tenant:read',
      'system:read',
      'iam:manage',
      'domain:manage',
      'audit:read',
      'config:read',
      'config:write',
    ];
  }

  updateUserAccess(userId: string, dto: UpdateUserAccessDto) {
    return this.authService.updateUserAccess(userId, {
      roles: dto.roles,
      permissions: dto.permissions,
    });
  }
}
