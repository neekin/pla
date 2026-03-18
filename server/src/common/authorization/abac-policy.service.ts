import { BadRequestException, Injectable } from '@nestjs/common';
import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { RequestWithUser } from '../types/request-with-user.type';

export interface AbacRule {
  key: string;
  enabled: boolean;
  allowedRoles?: string[];
  requireTenantMatch?: boolean;
  resourceTenantPath?: string;
  maskedFields?: string[];
}

export interface AbacPolicyFileContent {
  version: string;
  updatedAt: string;
  updatedBy: string;
  rules: AbacRule[];
}

@Injectable()
export class AbacPolicyService {
  private readonly rules = new Map<string, AbacRule>();
  private version = '1.0.0';
  private updatedAt = new Date(0).toISOString();
  private updatedBy = 'system';

  constructor() {
    this.reload();
  }

  listPolicies(): AbacPolicyFileContent {
    return {
      version: this.version,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
      rules: Array.from(this.rules.values()),
    };
  }

  updatePolicies(input: {
    rules: AbacRule[];
    actor: string;
  }): AbacPolicyFileContent {
    const normalizedRules = this.normalizeAndValidateRules(input.rules);
    const now = new Date().toISOString();

    const fileContent: AbacPolicyFileContent = {
      version: this.version,
      updatedAt: now,
      updatedBy: input.actor,
      rules: normalizedRules,
    };

    const filePath = this.resolvePolicyFilePath();
    const directoryPath = dirname(filePath);

    if (!existsSync(directoryPath)) {
      mkdirSync(directoryPath, { recursive: true });
    }

    writeFileSync(filePath, `${JSON.stringify(fileContent, null, 2)}\n`, 'utf8');

    this.reload();
    return this.listPolicies();
  }

  reload() {
    const filePath = this.resolvePolicyFilePath();

    if (!existsSync(filePath)) {
      return;
    }

    try {
      const parsed = JSON.parse(
        readFileSync(filePath, 'utf8'),
      ) as Partial<AbacPolicyFileContent>;

      this.rules.clear();

      this.version = typeof parsed.version === 'string' ? parsed.version : '1.0.0';
      this.updatedAt = typeof parsed.updatedAt === 'string'
        ? parsed.updatedAt
        : new Date().toISOString();
      this.updatedBy = typeof parsed.updatedBy === 'string' ? parsed.updatedBy : 'system';

      for (const rule of parsed.rules ?? []) {
        if (!rule?.key) {
          continue;
        }

        this.rules.set(rule.key, {
          ...rule,
          enabled: rule.enabled ?? true,
        });
      }
    } catch {
      this.rules.clear();
    }
  }

  evaluate(policyKey: string, request: RequestWithUser): { allowed: boolean; reason?: string } {
    const rule = this.rules.get(policyKey);

    if (!rule || !rule.enabled) {
      return { allowed: true };
    }

    const user = request.user;
    if (!user) {
      return { allowed: false, reason: 'UNAUTHORIZED' };
    }

    if (rule.allowedRoles?.length) {
      const hasRole = rule.allowedRoles.some((role) => user.roles.includes(role as never));
      if (!hasRole) {
        return { allowed: false, reason: 'ABAC_ROLE_DENIED' };
      }
    }

    if (rule.requireTenantMatch) {
      const isHostPlatformManager =
        user.tenantId === 'host'
        && user.roles.some((role) => role === 'admin' || role === 'operator');

      if (isHostPlatformManager) {
        return { allowed: true };
      }

      const resourceTenantId = this.readPathValue(request, rule.resourceTenantPath ?? 'params.tenantId');
      if (resourceTenantId && resourceTenantId !== user.tenantId) {
        return { allowed: false, reason: 'ABAC_TENANT_SCOPE_DENIED' };
      }
    }

    return { allowed: true };
  }

  applyFieldMask<T extends Record<string, unknown>>(policyKey: string, row: T): T {
    const rule = this.rules.get(policyKey);

    if (!rule || !rule.enabled || !rule.maskedFields?.length) {
      return row;
    }

    const copy = { ...row };

    for (const field of rule.maskedFields) {
      if (field in copy) {
        copy[field as keyof T] = '***' as T[keyof T];
      }
    }

    return copy;
  }

  private readPathValue(request: RequestWithUser, path: string): string | null {
    const [root, ...keys] = path.split('.');
    const source: Record<string, unknown> | undefined =
      root === 'params'
        ? (request.params as Record<string, unknown>)
        : root === 'body'
          ? (request.body as Record<string, unknown>)
          : root === 'query'
            ? (request.query as Record<string, unknown>)
            : undefined;

    if (!source) {
      return null;
    }

    let current: unknown = source;

    for (const key of keys) {
      if (!current || typeof current !== 'object') {
        return null;
      }

      current = (current as Record<string, unknown>)[key];
    }

    return typeof current === 'string' && current.trim() ? current : null;
  }

  private resolvePolicyFilePath() {
    return process.env.ABAC_POLICY_FILE
      ? resolve(process.env.ABAC_POLICY_FILE)
      : resolve(process.cwd(), 'data', 'abac-policy-rules.json');
  }

  private normalizeAndValidateRules(inputRules: AbacRule[]) {
    const keySet = new Set<string>();

    return inputRules.map((rule) => {
      const key = rule.key?.trim();
      if (!key) {
        throw new BadRequestException('ABAC 策略 key 不能为空');
      }

      if (keySet.has(key)) {
        throw new BadRequestException(`ABAC 策略 key 重复: ${key}`);
      }
      keySet.add(key);

      if (rule.resourceTenantPath && !/^(params|body|query)\.[a-zA-Z0-9_.]+$/.test(rule.resourceTenantPath)) {
        throw new BadRequestException(`resourceTenantPath 非法: ${rule.resourceTenantPath}`);
      }

      return {
        key,
        enabled: rule.enabled ?? true,
        allowedRoles: rule.allowedRoles?.map((item) => item.trim()).filter(Boolean),
        requireTenantMatch: rule.requireTenantMatch ?? false,
        resourceTenantPath: rule.resourceTenantPath?.trim() || undefined,
        maskedFields: rule.maskedFields?.map((item) => item.trim()).filter(Boolean),
      } satisfies AbacRule;
    });
  }
}
