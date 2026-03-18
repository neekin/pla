import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AuthLoginAttemptEntity } from '../database/entities/auth-login-attempt.entity';
import { AuthSecurityPolicyEntity } from '../database/entities/auth-security-policy.entity';
import { UserEntity } from '../database/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from './interfaces/auth-user.interface';

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
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AuthLoginAttemptEntity)
    private readonly attemptRepository: Repository<AuthLoginAttemptEntity>,
    @InjectRepository(AuthSecurityPolicyEntity)
    private readonly securityPolicyRepository: Repository<AuthSecurityPolicyEntity>,
  ) {}

  async getSecurityPolicy(): Promise<SecurityPolicy> {
    const policy = await this.getOrCreateHostSecurityPolicy();
    return this.toSecurityPolicy(policy);
  }

  async updateSecurityPolicy(patch: Partial<SecurityPolicy>, actor: string): Promise<SecurityPolicy> {
    if (
      patch.maxFailedAttempts !== undefined
      && (!Number.isInteger(patch.maxFailedAttempts)
        || patch.maxFailedAttempts < 1
        || patch.maxFailedAttempts > 20)
    ) {
      throw new BadRequestException('maxFailedAttempts 必须是 1-20 的整数');
    }

    if (
      patch.lockoutMinutes !== undefined
      && (!Number.isInteger(patch.lockoutMinutes)
        || patch.lockoutMinutes < 1
        || patch.lockoutMinutes > 1440)
    ) {
      throw new BadRequestException('lockoutMinutes 必须是 1-1440 的整数');
    }

    if (
      patch.minPasswordLength !== undefined
      && (!Number.isInteger(patch.minPasswordLength)
        || patch.minPasswordLength < 4
        || patch.minPasswordLength > 64)
    ) {
      throw new BadRequestException('minPasswordLength 必须是 4-64 的整数');
    }

    const boolKeys: (keyof Pick<SecurityPolicy, 'requireUppercase' | 'requireLowercase' | 'requireNumbers' | 'requireSymbols'>)[] = [
      'requireUppercase',
      'requireLowercase',
      'requireNumbers',
      'requireSymbols',
    ];

    const policyBoolKeys: (keyof Pick<SecurityPolicy, 'forcePasswordResetOnFirstLogin' | 'rejectWeakPasswordOnLogin'>)[] = [
      'forcePasswordResetOnFirstLogin',
      'rejectWeakPasswordOnLogin',
    ];

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
        (policy as unknown as Record<string, unknown>)[key] = patch[key] as unknown;
      }
    }

    policy.updatedBy = actor;
    await this.securityPolicyRepository.save(policy);

    return this.toSecurityPolicy(policy);
  }

  async login(dto: LoginDto, tenantId: string, ipAddress?: string) {
    const policy = await this.getSecurityPolicy();

    // 先查账号（不验密），检查锁定状态
    const userByName = await this.userRepository.findOne({
      where: { tenantId, username: dto.username },
    });

    if (userByName?.lockedUntil && userByName.lockedUntil > new Date()) {
      const remainMin = Math.ceil((userByName.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`账号已锁定，请 ${remainMin} 分钟后重试`);
    }

    // 验证密码
    const user = await this.userRepository.findOne({
      where: { tenantId, username: dto.username, password: dto.password },
    });

    // 记录登录尝试
    await this.attemptRepository.save(
      this.attemptRepository.create({ tenantId, username: dto.username, success: !!user, ipAddress: ipAddress ?? null }),
    );

    if (!user) {
      // 统计窗口内失败次数，触发锁定
      if (userByName) {
        const windowStart = new Date(Date.now() - policy.lockoutMinutes * 60 * 1000);
        const failCount = await this.attemptRepository.count({
          where: { tenantId, username: dto.username, success: false, attemptedAt: MoreThan(windowStart) },
        });
        if (failCount >= policy.maxFailedAttempts) {
          userByName.lockedUntil = new Date(Date.now() + policy.lockoutMinutes * 60 * 1000);
          await this.userRepository.save(userByName);
          throw new UnauthorizedException(
            `连续失败 ${policy.maxFailedAttempts} 次，账号已锁定 ${policy.lockoutMinutes} 分钟`,
          );
        }
      }
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
        throw new UnauthorizedException('WEAK_PASSWORD_RESET_REQUIRED');
      }
    } else if (policy.forcePasswordResetOnFirstLogin && user.requiresPasswordReset) {
      await this.userRepository.save(user);
    }

    const authUser: AuthUser = {
      userId: user.id,
      username: user.username,
      tenantId,
      roles: user.roles as Role[],
      permissions: user.permissions,
    };

    const accessToken = await this.jwtService.signAsync(authUser);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: { ...authUser, requiresPasswordReset: user.requiresPasswordReset },
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
      throw new BadRequestException(`新密码不符合安全策略：${violations.join('；')}`);
    }

    user.password = newPassword;
    user.requiresPasswordReset = false;
    user.lockedUntil = null;
    user.passwordResetAt = new Date();
    user.updatedAt = new Date();

    await this.userRepository.save(user);

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

    if (dto.roles) {
      user.roles = dto.roles;
    }

    if (dto.permissions) {
      user.permissions = dto.permissions;
    }

    user.updatedAt = new Date();

    await this.userRepository.save(user);

    return {
      message: '用户权限更新成功',
      user: {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        roles: user.roles as Role[],
        permissions: user.permissions,
      },
    };
  }

  private getPasswordPolicyViolations(password: string, policy: SecurityPolicy): string[] {
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
}
