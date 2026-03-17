import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { AuthLoginAttemptEntity } from '../database/entities/auth-login-attempt.entity';
import { PlatformSettingEntity } from '../database/entities/platform-setting.entity';
import { UserEntity } from '../database/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from './interfaces/auth-user.interface';

export interface SecurityPolicy {
  maxFailedAttempts: number;
  lockoutMinutes: number;
  minPasswordLength: number;
}

const DEFAULT_POLICY: SecurityPolicy = {
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  minPasswordLength: 6,
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
    @InjectRepository(PlatformSettingEntity)
    private readonly settingRepository: Repository<PlatformSettingEntity>,
  ) {}

  async getSecurityPolicy(): Promise<SecurityPolicy> {
    const keys: (keyof SecurityPolicy)[] = ['maxFailedAttempts', 'lockoutMinutes', 'minPasswordLength'];
    const rows = await this.settingRepository.find({
      where: keys.map((k) => ({ scopeType: 'host' as const, scopeId: 'host', key: `auth.${k}` })),
    });
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      const k = (row.key as string).replace('auth.', '');
      map[k] = row.value;
    }
    return {
      maxFailedAttempts: (map['maxFailedAttempts'] as number) ?? DEFAULT_POLICY.maxFailedAttempts,
      lockoutMinutes: (map['lockoutMinutes'] as number) ?? DEFAULT_POLICY.lockoutMinutes,
      minPasswordLength: (map['minPasswordLength'] as number) ?? DEFAULT_POLICY.minPasswordLength,
    };
  }

  async updateSecurityPolicy(patch: Partial<SecurityPolicy>, actor: string): Promise<SecurityPolicy> {
    const allowedKeys: (keyof SecurityPolicy)[] = ['maxFailedAttempts', 'lockoutMinutes', 'minPasswordLength'];
    for (const k of allowedKeys) {
      if (patch[k] === undefined) continue;
      const key = `auth.${k}`;
      const existing = await this.settingRepository.findOne({
        where: { scopeType: 'host', scopeId: 'host', key },
      });
      if (existing) {
        existing.value = patch[k] as unknown;
        existing.updatedBy = actor;
        await this.settingRepository.save(existing);
      } else {
        await this.settingRepository.save(
          this.settingRepository.create({ scopeType: 'host', scopeId: 'host', key, value: patch[k] as unknown, updatedBy: actor }),
        );
      }
    }
    return this.getSecurityPolicy();
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
}
