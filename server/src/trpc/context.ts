import { JwtService } from '@nestjs/jwt';
import { AuthUser } from '../auth/interfaces/auth-user.interface';

interface CreateTrpcContextInput {
  req: {
    headers: {
      authorization?: string;
      host?: string;
      ['x-tenant-id']?: string;
    };
  };
}

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
});

export function createTrpcContext({ req }: CreateTrpcContextInput) {
  const tenantId = req.headers['x-tenant-id'] ?? 'host';
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      tenantId,
      user: null as AuthUser | null,
    };
  }

  const token = authHeader.slice(7);

  try {
    const user = jwtService.verify<AuthUser>(token);
    return {
      tenantId,
      user,
    };
  } catch {
    return {
      tenantId,
      user: null as AuthUser | null,
    };
  }
}

export type TrpcContext = ReturnType<typeof createTrpcContext>;
