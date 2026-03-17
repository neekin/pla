import { Role } from '../../common/enums/role.enum';

export interface AuthUser {
  userId: string;
  username: string;
  tenantId: string;
  roles: Role[];
  permissions: string[];
}
