import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/permission.constant';
import { Role } from '../enums/role.enum';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
