import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuthLoginAttemptEntity } from '../database/entities/auth-login-attempt.entity';
import { AuthRefreshTokenEntity } from '../database/entities/auth-refresh-token.entity';
import { AuthSecurityPolicyEntity } from '../database/entities/auth-security-policy.entity';
import { UserEntity } from '../database/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from './interfaces/auth-user.interface';
import { MailService } from '../notifications/mail.service';
import { MetricsService } from '../system/metrics.service';

export interface SecurityPolicy {
  maxFailedAttempts: number;
  lockoutMinutes: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  forcePasswordResetOnFirstLogin: boolean;
  rejectWeakPasswordOnLogin: boolean;
}

const DEFAULT_POLICY: SecurityPolicy = {
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  minPasswordLength: 6,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSymbols: false,
  forcePasswordResetOnFirstLogin: false,
  rejectWeakPasswordOnLogin: false,
};

interface UpdateUserAccessInput {
  roles?: Role[];
  permissions?: string[];
  actor?: AuthUser;
}

interface SessionClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly refreshTokenTtlDays = Number(
    process.env.REFRESH_TOKEN_TTL_DAYS ?? 14,
  );

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly metricsService: MetricsService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AuthLoginAttemptEntity)
    private readonly attemptRepository: Repository<AuthLoginAttemptEntity>,
    @InjectRepository(AuthRefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<AuthRefreshTokenEntity>,
    @InjectRepository(AuthSecurityPolicyEntity)
    private readonly securityPolicyRepository: Repository<AuthSecurityPolicyEntity>,
  ) {}

  async getSecurityPolicy(): Promise<SecurityPolicy> {
    const policy = await this.getOrCreateHostSecurityPolicy();
    return this.toSecurityPolicy(policy);
  }

  async updateSecurityPolicy(
    patch: Partial<SecurityPolicy>,
    actor: string,
  ): Promise<SecurityPolicy> {
    if (
      patch.maxFailedAttempts !== undefined &&
      (!Number.isInteger(patch.maxFailedAttempts) ||
        patch.maxFailedAttempts < 1 ||
        patch.maxFailedAttempts > 20)
    ) {
      throw new BadRequestException('maxFailedAttempts 必须是 1-20 的整数');
    }

    if (
      patch.lockoutMinutes !== undefined &&
      (!Number.isInteger(patch.lockoutMinutes) ||
        patch.lockoutMinutes < 1 ||
        patch.lockoutMinutes > 1440)
    ) {
      throw new BadRequestException('lockoutMinutes 必须是 1-1440 的整数');
    }

    if (
      patch.minPasswordLength !== undefined &&
      (!Number.isInteger(patch.minPasswordLength) ||
        patch.minPasswordLength < 4 ||
        patch.minPasswordLength > 64)
    ) {
      throw new BadRequestException('minPasswordLength 必须是 4-64 的整数');
    }

    const boolKeys: (keyof Pick<
      SecurityPolicy,
      | 'requireUppercase'
      | 'requireLowercase'
      | 'requireNumbers'
      | 'requireSymbols'
    >)[] = [
      'requireUppercase',
      'requireLowercase',
      'requireNumbers',
      'requireSymbols',
    ];

    const policyBoolKeys: (keyof Pick<
      SecurityPolicy,
      'forcePasswordResetOnFirstLogin' | 'rejectWeakPasswordOnLogin'
    >)[] = ['forcePasswordResetOnFirstLogin', 'rejectWeakPasswordOnLogin'];

    for (const key of boolKeys) {
      if (patch[key] !== undefined && typeof patch[key] !== 'boolean') {
        throw new BadRequestException(`${key} 必须是 boolean`);
      }
    }

    for (const key of policyBoolKeys) {
      if (patch[key] !== undefined && typeof patch[key] !== 'boolean') {
        throw new BadRequestException(`${key} 必须是 boolean`);
      }
    }

    const policy = await this.getOrCreateHostSecurityPolicy();

    const allowedKeys: (keyof SecurityPolicy)[] = [
      'maxFailedAttempts',
      'lockoutMinutes',
      'minPasswordLength',
      'requireUppercase',
      'requireLowercase',
      'requireNumbers',
      'requireSymbols',
      'forcePasswordResetOnFirstLogin',
      'rejectWeakPasswordOnLogin',
    ];

    for (const key of allowedKeys) {
      if (patch[key] !== undefined) {
        (policy as unknown as Record<string, unknown>)[key] = patch[
          key
        ] as unknown;
      }
    }

    policy.updatedBy = actor;
    await this.securityPolicyRepository.save(policy);

    return this.toSecurityPolicy(policy);
  }

  async login(dto: LoginDto, tenantId: string, clientMeta?: SessionClientMeta) {
    const policy = await this.getSecurityPolicy();

    // 先查账号（不验密），检查锁定状态
    const userByName = await this.userRepository.findOne({
      where: { tenantId, username: dto.username },
    });

    if (userByName?.lockedUntil && userByName.lockedUntil > new Date()) {
      const remainMin = Math.ceil(
        (userByName.lockedUntil.getTime() - Date.now()) / 60000,
      );
      this.metricsService.recordAuthLogin(false);
      throw new UnauthorizedException(`账号已锁定，请 ${remainMin} 分钟后重试`);
    }

    // 验证密码
    const user = await this.userRepository.findOne({
      where: { tenantId, username: dto.username, password: dto.password },
    });

    // 记录登录尝试
    await this.attemptRepository.save(
      this.attemptRepository.create({
        tenantId,
        username: dto.username,
        success: !!user,
        ipAddress: clientMeta?.ipAddress ?? null,
      }),
    );

    if (!user) {
      // 统计窗口内失败次数，触发锁定
      if (userByName) {
        const windowStart = new Date(
          Date.now() - policy.lockoutMinutes * 60 * 1000,
        );
        const failCount = await this.attemptRepository.count({
          where: {
            tenantId,
            username: dto.username,
            success: false,
            attemptedAt: MoreThan(windowStart),
          },
        });
        if (failCount >= policy.maxFailedAttempts) {
          userByName.lockedUntil = new Date(
            Date.now() + policy.lockoutMinutes * 60 * 1000,
          );
          await this.userRepository.save(userByName);
          await this.sendSecurityAlertEmail({
            username: userByName.username,
            title: '账号触发锁定保护',
            content: `账号 ${userByName.username} 在租户 ${tenantId} 连续登录失败，已锁定 ${policy.lockoutMinutes} 分钟。`,
          });
          this.metricsService.recordAuthLogin(false);
          throw new UnauthorizedException(
            `连续失败 ${policy.maxFailedAttempts} 次，账号已锁定 ${policy.lockoutMinutes} 分钟`,
          );
        }
      }
      this.metricsService.recordAuthLogin(false);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功：清除锁定
    if (user.lockedUntil) {
      user.lockedUntil = null;
      await this.userRepository.save(user);
    }

    if (policy.forcePasswordResetOnFirstLogin && !user.passwordResetAt) {
      user.requiresPasswordReset = true;
    }

    const violations = this.getPasswordPolicyViolations(dto.password, policy);
    if (violations.length > 0) {
      user.requiresPasswordReset = true;
      await this.userRepository.save(user);

      if (policy.rejectWeakPasswordOnLogin) {
        this.metricsService.recordAuthLogin(false);
        throw new UnauthorizedException('WEAK_PASSWORD_RESET_REQUIRED');
      }
    } else if (
      policy.forcePasswordResetOnFirstLogin &&
      user.requiresPasswordReset
    ) {
      await this.userRepository.save(user);
    }

    const authUser: AuthUser = {
      userId: user.id,
      username: user.username,
      tenantId,
      roles: user.roles as Role[],
      permissions: user.permissions,
    };

    const tokens = await this.issueTokenPair(authUser, tenantId, clientMeta);
    this.metricsService.recordAuthLogin(true);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshExpiresInSeconds: tokens.refreshExpiresInSeconds,
      tokenType: 'Bearer',
      user: { ...authUser, requiresPasswordReset: user.requiresPasswordReset },
    };
  }

  async refreshTokens(
    refreshToken: string,
    tenantId: string,
    clientMeta?: SessionClientMeta,
  ) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const existing = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash,
        tenantId,
      },
    });

    if (!existing) {
      throw new UnauthorizedException('刷新令牌无效');
    }

    if (existing.revokedAt) {
      throw new UnauthorizedException('刷新令牌已失效');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('刷新令牌已过期');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: existing.userId,
        tenantId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在或已失效');
    }

    const authUser: AuthUser = {
      userId: user.id,
      username: user.username,
      tenantId,
      roles: user.roles as Role[],
      permissions: user.permissions,
    };

    const nextTokens = await this.issueTokenPair(
      authUser,
      tenantId,
      clientMeta,
    );

    existing.revokedAt = new Date();
    existing.replacedByTokenId = nextTokens.tokenId;
    await this.refreshTokenRepository.save(existing);

    return {
      accessToken: nextTokens.accessToken,
      refreshToken: nextTokens.refreshToken,
      refreshExpiresInSeconds: nextTokens.refreshExpiresInSeconds,
      tokenType: 'Bearer',
      user: {
        ...authUser,
        requiresPasswordReset: user.requiresPasswordReset,
      },
    };
  }

  async revokeRefreshToken(refreshToken: string, tenantId: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const existing = await this.refreshTokenRepository.findOne({
      where: {
        tokenHash,
        tenantId,
      },
    });

    if (!existing) {
      return { message: '登出完成' };
    }

    if (!existing.revokedAt) {
      existing.revokedAt = new Date();
      await this.refreshTokenRepository.save(existing);
    }

    return { message: '登出完成' };
  }

  async listSessions(
    userId: string,
    tenantId: string,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      tenantId: string;
      createdAt: string;
      expiresAt: string;
      revokedAt: string | null;
      createdByIp: string | null;
      userAgent: string | null;
      status: 'active' | 'expired' | 'revoked';
    }>
  > {
    const rows = await this.refreshTokenRepository.find({
      where: {
        userId,
        tenantId,
      },
      order: {
        createdAt: 'DESC',
      },
      take: 200,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      createdByIp: row.createdByIp,
      userAgent: row.userAgent,
      status: row.revokedAt
        ? 'revoked'
        : row.expiresAt.getTime() <= Date.now()
          ? 'expired'
          : 'active',
    }));
  }

  async revokeSessionById(
    sessionId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ message: string; sessionId: string; revokedAt: string | null }> {
    const existing = await this.refreshTokenRepository.findOne({
      where: {
        id: sessionId,
        userId,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('会话不存在');
    }

    if (!existing.revokedAt) {
      existing.revokedAt = new Date();
      await this.refreshTokenRepository.save(existing);
    }

    return {
      message: '会话已吊销',
      sessionId: existing.id,
      revokedAt: existing.revokedAt?.toISOString() ?? null,
    };
  }

  async resetPassword(userId: string, tenantId: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.performPasswordReset(user, newPassword);
  }

  async resetPasswordByCredentials(input: {
    tenantId: string;
    username: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const user = await this.userRepository.findOne({
      where: {
        tenantId: input.tenantId,
        username: input.username,
        password: input.currentPassword,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或当前密码错误');
    }

    return this.performPasswordReset(user, input.newPassword);
  }

  private async performPasswordReset(user: UserEntity, newPassword: string) {
    if (newPassword === user.password) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    const policy = await this.getSecurityPolicy();
    const violations = this.getPasswordPolicyViolations(newPassword, policy);

    if (violations.length > 0) {
      throw new BadRequestException(
        `新密码不符合安全策略：${violations.join('；')}`,
      );
    }

    user.password = newPassword;
    user.requiresPasswordReset = false;
    user.lockedUntil = null;
    user.passwordResetAt = new Date();
    user.updatedAt = new Date();

    await this.userRepository.save(user);

    await this.refreshTokenRepository.update(
      {
        userId: user.id,
        tenantId: user.tenantId,
        revokedAt: IsNull(),
      },
      {
        revokedAt: new Date(),
      },
    );

    await this.sendSecurityAlertEmail({
      username: user.username,
      title: '密码已重置',
      content: `账号 ${user.username} 在租户 ${user.tenantId} 完成了密码重置。若非本人操作，请立即联系管理员。`,
    });

    return {
      message: '密码重置成功',
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        roles: user.roles as Role[],
        permissions: user.permissions,
        requiresPasswordReset: false,
      },
    };
  }

  profile(user: AuthUser) {
    return {
      user,
      platform: {
        mode: 'starter',
        message: '当前为开箱即用平台骨架，可逐步接入业务模块。',
      },
    };
  }

  async listUsers() {
    const users = await this.userRepository.find({
      order: {
        tenantId: 'ASC',
        username: 'ASC',
      },
    });

    return users.map((user) => ({
      id: user.id,
      tenantId: user.tenantId,
      username: user.username,
      roles: user.roles as Role[],
      permissions: user.permissions,
    }));
  }

  async updateUserAccess(userId: string, dto: UpdateUserAccessInput) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const previousRoles = [...(user.roles as Role[])];
    const previousPermissions = [...user.permissions];

    if (dto.roles) {
      user.roles = dto.roles;
    }

    if (dto.permissions) {
      user.permissions = dto.permissions;
    }

    user.updatedAt = new Date();

    await this.userRepository.save(user);

    const changes: Record<string, { before: unknown; after: unknown }> = {};

    if (JSON.stringify(previousRoles) !== JSON.stringify(user.roles)) {
      changes.roles = { before: previousRoles, after: user.roles };
    }

    if (
      JSON.stringify(previousPermissions) !== JSON.stringify(user.permissions)
    ) {
      changes.permissions = {
        before: previousPermissions,
        after: user.permissions,
      };
    }

    return {
      message: '用户权限更新成功',
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        roles: user.roles as Role[],
        permissions: user.permissions,
      },
      __entityAudit: {
        entityId: user.id,
        changes,
        tenantId: user.tenantId,
        actor: dto.actor,
      },
    };
  }

  private getPasswordPolicyViolations(
    password: string,
    policy: SecurityPolicy,
  ): string[] {
    const violations: string[] = [];

    if (password.length < policy.minPasswordLength) {
      violations.push(`长度至少 ${policy.minPasswordLength} 位`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      violations.push('至少包含 1 个大写字母');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      violations.push('至少包含 1 个小写字母');
    }

    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      violations.push('至少包含 1 个数字');
    }

    if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
      violations.push('至少包含 1 个特殊字符');
    }

    return violations;
  }

  private async getOrCreateHostSecurityPolicy() {
    const existing = await this.securityPolicyRepository.findOne({
      where: {
        scopeType: 'host',
        scopeId: 'host',
      },
    });

    if (existing) {
      return existing;
    }

    return this.securityPolicyRepository.save(
      this.securityPolicyRepository.create({
        scopeType: 'host',
        scopeId: 'host',
        ...DEFAULT_POLICY,
        updatedBy: 'system',
      }),
    );
  }

  private toSecurityPolicy(policy: AuthSecurityPolicyEntity): SecurityPolicy {
    return {
      maxFailedAttempts: policy.maxFailedAttempts,
      lockoutMinutes: policy.lockoutMinutes,
      minPasswordLength: policy.minPasswordLength,
      requireUppercase: policy.requireUppercase,
      requireLowercase: policy.requireLowercase,
      requireNumbers: policy.requireNumbers,
      requireSymbols: policy.requireSymbols,
      forcePasswordResetOnFirstLogin: policy.forcePasswordResetOnFirstLogin,
      rejectWeakPasswordOnLogin: policy.rejectWeakPasswordOnLogin,
    };
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokenPair(
    authUser: AuthUser,
    tenantId: string,
    clientMeta?: SessionClientMeta,
  ) {
    const accessToken = await this.jwtService.signAsync(authUser);
    const refreshToken = randomBytes(48).toString('base64url');
    const tokenId = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        id: tokenId,
        userId: authUser.userId,
        tenantId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt,
        revokedAt: null,
        replacedByTokenId: null,
        createdByIp: clientMeta?.ipAddress ?? null,
        userAgent: clientMeta?.userAgent?.slice(0, 255) ?? null,
      }),
    );

    return {
      accessToken,
      refreshToken,
      tokenId,
      refreshExpiresInSeconds: Math.max(
        1,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      ),
    };
  }

  private async sendSecurityAlertEmail(input: {
    username: string;
    title: string;
    content: string;
  }) {
    const userEmail = input.username.includes('@') ? input.username : null;
    const fallbackEmail = process.env.SECURITY_ALERT_EMAIL?.trim() || null;
    const recipient = userEmail ?? fallbackEmail;

    if (!recipient) {
      return;
    }

    await this.mailService.sendMail({
      to: recipient,
      subject: `[GigPayday] ${input.title}`,
      text: input.content,
    });
  }
}
