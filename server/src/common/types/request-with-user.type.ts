import { Request } from 'express';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';

export interface RequestWithUser extends Request {
  user?: AuthUser;
  tenantId?: string;
}
