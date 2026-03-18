import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EditionEntity } from '../database/entities/edition.entity';
import { PlatformSettingEntity } from '../database/entities/platform-setting.entity';
import { SubscriptionEventEntity } from '../database/entities/subscription-event.entity';
import { TenantEntity } from '../database/entities/tenant.entity';
import { TenantSubscriptionEntity } from '../database/entities/tenant-subscription.entity';
import { UsageMeterEntity } from '../database/entities/usage-meter.entity';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { ListUsageDto } from './dto/list-usage.dto';
import { ReportUsageDto } from './dto/report-usage.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';

export type OverageStrategy = 'reject' | 'degrade';

interface SubscriptionQuotaView {
  capabilityPoint: string;
  limit: number;
  used: number;
  usageRate: number;
  exceeded: boolean;
  unlimited: boolean;
}

export interface TenantSubscriptionView {
  tenantId: string;
  editionId: string;
  plan: string;
  editionName: string;
  status: 'trialing' | 'active' | 'expired';
  trialStartAt: string | null;
  trialEndAt: string | null;
  currentPeriodStartAt: string | null;
  currentPeriodEndAt: string | null;
  overageStrategy: OverageStrategy;
  quota: SubscriptionQuotaView;
  updatedAt: string;
}

export interface QuotaEvaluationResult {
  tenantId: string;
  capabilityPoint: string;
  strategy: OverageStrategy;
  status: 'trialing' | 'active' | 'expired';
  limit: number;
  used: number;
  exceeded: boolean;
  reason: string | null;
}

export interface UsageMeterView {
  id: string;
  tenantId: string;
  capabilityPoint: string;
  totalUsed: number;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
}

const CAPABILITY_TASK_DISPATCH = 'task.dispatch';
const OVERAGE_SETTING_KEY = 'quota.overageStrategy';

const DEFAULT_MONTHLY_QUOTA: Record<string, number> = {
  free: 2,
  pro: 20,
  enterprise: -1,
};

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(EditionEntity)
    private readonly editionRepository: Repository<EditionEntity>,
    @InjectRepository(TenantSubscriptionEntity)
    private readonly subscriptionRepository: Repository<TenantSubscriptionEntity>,
    @InjectRepository(SubscriptionEventEntity)
    private readonly subscriptionEventRepository: Repository<SubscriptionEventEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(PlatformSettingEntity)
    private readonly settingRepository: Repository<PlatformSettingEntity>,
    @InjectRepository(UsageMeterEntity)
    private readonly usageMeterRepository: Repository<UsageMeterEntity>,
  ) {}

  async listEditions() {
    const rows = await this.editionRepository.find({
      order: { plan: 'ASC' },
    });

    return rows.map((row) => ({
      id: row.id,
      plan: row.plan,
      name: row.name,
      status: row.status,
      trialDays: row.trialDays,
      quota: row.quota,
      description: row.description,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncSubscriptionStatusesBySchedule() {
    const rows = await this.subscriptionRepository.find({
      where: [{ status: 'trialing' }, { status: 'active' }],
      take: 1000,
      order: {
        updatedAt: 'ASC',
      },
    });

    for (const row of rows) {
      await this.syncSubscriptionStatus(row, 'system-cron');
    }
  }

  async getTenantSubscription(tenantId: string): Promise<TenantSubscriptionView> {
    const subscription = await this.ensureTenantSubscription(tenantId, 'system-query');
    const strategy = await this.getOverageStrategy();
    return this.toSubscriptionView(subscription, strategy);
  }

  async assignSubscription(dto: AssignSubscriptionDto, actor: string): Promise<{ message: string; subscription: TenantSubscriptionView }> {
    const tenant = await this.tenantRepository.findOne({ where: { id: dto.tenantId } });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    const edition = await this.editionRepository.findOne({ where: { id: dto.editionId } });

    if (!edition || edition.status !== 'active') {
      throw new NotFoundException('版本不存在或不可用');
    }

    const trialDays = dto.trialDays ?? edition.trialDays;
    const now = new Date();
    const status: TenantSubscriptionEntity['status'] = trialDays > 0 ? 'trialing' : 'active';
    const quota = this.buildQuotaSnapshot(edition, dto.quotaTaskDispatchMonthly);

    const existing = await this.subscriptionRepository.findOne({ where: { tenantId: tenant.id } });
    const target = existing ?? this.subscriptionRepository.create({
      tenantId: tenant.id,
      editionId: edition.id,
      plan: edition.plan,
      status,
      trialStartAt: null,
      trialEndAt: null,
      currentPeriodStartAt: null,
      currentPeriodEndAt: null,
      quota,
      usage: {},
      updatedBy: actor,
    });

    target.editionId = edition.id;
    target.plan = edition.plan;
    target.status = status;
    target.quota = quota;
    target.usage = {};
    target.updatedBy = actor;

    if (status === 'trialing') {
      target.trialStartAt = now;
      target.trialEndAt = this.addDays(now, trialDays);
      target.currentPeriodStartAt = null;
      target.currentPeriodEndAt = null;
    } else {
      target.trialStartAt = null;
      target.trialEndAt = null;
      target.currentPeriodStartAt = now;
      target.currentPeriodEndAt = this.addMonths(now, 1);
    }

    const saved = await this.subscriptionRepository.save(target);

    if (edition.plan === 'free' || edition.plan === 'pro' || edition.plan === 'enterprise') {
      tenant.edition = edition.plan;
      await this.tenantRepository.save(tenant);
    }

    await this.createSubscriptionEvent({
      tenantId: tenant.id,
      eventType: 'subscription.assigned',
      detail: {
        editionId: edition.id,
        plan: edition.plan,
        trialDays,
        quota,
      },
      actor,
    });

    const strategy = await this.getOverageStrategy();

    return {
      message: '订阅分配成功',
      subscription: this.toSubscriptionView(saved, strategy),
    };
  }

  async renewSubscription(dto: RenewSubscriptionDto, actor: string): Promise<{ message: string; subscription: TenantSubscriptionView }> {
    const months = dto.months ?? 1;
    const subscription = await this.ensureTenantSubscription(dto.tenantId, actor);
    const now = new Date();
    const baseline =
      subscription.currentPeriodEndAt && subscription.currentPeriodEndAt > now
        ? subscription.currentPeriodEndAt
        : now;

    subscription.status = 'active';
    subscription.currentPeriodStartAt = now;
    subscription.currentPeriodEndAt = this.addMonths(baseline, months);
    subscription.usage = {};
    subscription.updatedBy = actor;

    const saved = await this.subscriptionRepository.save(subscription);

    await this.createSubscriptionEvent({
      tenantId: saved.tenantId,
      eventType: 'subscription.renewed',
      detail: {
        months,
        currentPeriodEndAt: saved.currentPeriodEndAt?.toISOString() ?? null,
      },
      actor,
    });

    const strategy = await this.getOverageStrategy();

    return {
      message: '续费成功',
      subscription: this.toSubscriptionView(saved, strategy),
    };
  }

  async reportUsage(
    dto: ReportUsageDto,
    actor: string,
  ): Promise<{ message: string; usage: UsageMeterView }> {
    const tenant = await this.tenantRepository.findOne({ where: { id: dto.tenantId } });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    const periodStart = this.resolvePeriodStart(dto.periodStart);
    const periodEnd = this.addMonths(periodStart, 1);

    let usageMeter = await this.usageMeterRepository.findOne({
      where: {
        tenantId: dto.tenantId,
        capabilityPoint: dto.capabilityPoint,
        periodStart,
      },
    });

    if (!usageMeter) {
      usageMeter = this.usageMeterRepository.create({
        tenantId: dto.tenantId,
        capabilityPoint: dto.capabilityPoint,
        totalUsed: 0,
        periodStart,
        periodEnd,
        updatedBy: actor,
      });
    }

    usageMeter.totalUsed += dto.amount;
    usageMeter.updatedBy = actor;
    usageMeter = await this.usageMeterRepository.save(usageMeter);

    const subscription = await this.ensureTenantSubscription(dto.tenantId, actor);
    const usage = this.toNumberMap(subscription.usage);
    usage[dto.capabilityPoint] = (usage[dto.capabilityPoint] ?? 0) + dto.amount;
    subscription.usage = usage;
    subscription.updatedBy = actor;
    await this.subscriptionRepository.save(subscription);

    await this.createSubscriptionEvent({
      tenantId: dto.tenantId,
      eventType: 'usage.reported',
      detail: {
        capabilityPoint: dto.capabilityPoint,
        amount: dto.amount,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
      actor,
    });

    return {
      message: '用量上报成功',
      usage: this.toUsageMeterView(usageMeter),
    };
  }

  async listUsage(tenantId: string, query: ListUsageDto): Promise<UsageMeterView[]> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    const builder = this.usageMeterRepository
      .createQueryBuilder('usage')
      .where('usage.tenantId = :tenantId', { tenantId });

    if (query.capabilityPoint?.trim()) {
      builder.andWhere('usage.capabilityPoint = :capabilityPoint', {
        capabilityPoint: query.capabilityPoint.trim(),
      });
    }

    if (query.from) {
      builder.andWhere('usage.periodStart >= :from', {
        from: new Date(query.from),
      });
    }

    if (query.to) {
      builder.andWhere('usage.periodEnd <= :to', {
        to: new Date(query.to),
      });
    }

    const rows = await builder
      .orderBy('usage.periodStart', 'DESC')
      .addOrderBy('usage.capabilityPoint', 'ASC')
      .take(200)
      .getMany();

    return rows.map((row) => this.toUsageMeterView(row));
  }

  async evaluateQuota(tenantId: string, capabilityPoint: string): Promise<QuotaEvaluationResult> {
    const subscription = await this.ensureTenantSubscription(tenantId, 'quota-evaluation');
    const strategy = await this.getOverageStrategy();
    const limit = this.getQuotaLimit(subscription, capabilityPoint);
    const used = this.getUsageCount(subscription, capabilityPoint);

    if (subscription.status === 'expired') {
      return {
        tenantId,
        capabilityPoint,
        strategy,
        status: subscription.status,
        limit,
        used,
        exceeded: true,
        reason: 'SUBSCRIPTION_EXPIRED',
      };
    }

    const exceeded = limit >= 0 && used >= limit;

    return {
      tenantId,
      capabilityPoint,
      strategy,
      status: subscription.status,
      limit,
      used,
      exceeded,
      reason: exceeded
        ? `QUOTA_LIMIT_EXCEEDED:${capabilityPoint}:${used}/${limit}`
        : null,
    };
  }

  async consumeQuota(input: {
    tenantId: string;
    capabilityPoint: string;
    amount: number;
    actor: string;
  }) {
    const evaluation = await this.evaluateQuota(input.tenantId, input.capabilityPoint);

    if (evaluation.exceeded && evaluation.strategy === 'reject') {
      throw new HttpException(
        evaluation.reason ?? 'QUOTA_EXCEEDED',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const subscription = await this.ensureTenantSubscription(input.tenantId, input.actor);
    const usage = this.toNumberMap(subscription.usage);
    const currentUsed = usage[input.capabilityPoint] ?? 0;
    usage[input.capabilityPoint] = currentUsed + input.amount;

    subscription.usage = usage;
    subscription.updatedBy = input.actor;

    await this.subscriptionRepository.save(subscription);

    if (evaluation.exceeded) {
      await this.recordQuotaEvent({
        tenantId: input.tenantId,
        capabilityPoint: input.capabilityPoint,
        strategy: evaluation.strategy,
        reason: evaluation.reason ?? 'QUOTA_EXCEEDED',
        actor: input.actor,
      });
    }

    const limit = this.getQuotaLimit(subscription, input.capabilityPoint);
    const used = this.getUsageCount(subscription, input.capabilityPoint);

    return {
      degraded: evaluation.exceeded && evaluation.strategy === 'degrade',
      reason: evaluation.exceeded ? (evaluation.reason ?? 'QUOTA_EXCEEDED') : null,
      limit,
      used,
      usageRate: this.calculateUsageRate(used, limit),
    };
  }

  async recordQuotaEvent(input: {
    tenantId: string;
    capabilityPoint: string;
    strategy: OverageStrategy;
    reason: string;
    actor: string;
  }) {
    await this.createSubscriptionEvent({
      tenantId: input.tenantId,
      eventType: input.strategy === 'reject' ? 'quota.rejected' : 'quota.degraded',
      detail: {
        capabilityPoint: input.capabilityPoint,
        reason: input.reason,
      },
      actor: input.actor,
    });
  }

  private async ensureTenantSubscription(tenantId: string, actor: string) {
    const existing = await this.subscriptionRepository.findOne({
      where: { tenantId },
    });

    if (existing) {
      return this.syncSubscriptionStatus(existing, actor);
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    const edition =
      (await this.editionRepository.findOne({ where: { id: tenant.edition } }))
      ?? (await this.editionRepository.findOne({ where: { plan: tenant.edition } }));

    if (!edition) {
      throw new NotFoundException('默认版本不存在，请先初始化 editions');
    }

    const now = new Date();
    const isTrialing = tenant.id !== 'host' && edition.trialDays > 0;

    const created = await this.subscriptionRepository.save(
      this.subscriptionRepository.create({
        tenantId: tenant.id,
        editionId: edition.id,
        plan: edition.plan,
        status: isTrialing ? 'trialing' : 'active',
        trialStartAt: isTrialing ? now : null,
        trialEndAt: isTrialing ? this.addDays(now, edition.trialDays) : null,
        currentPeriodStartAt: isTrialing ? null : now,
        currentPeriodEndAt: isTrialing ? null : this.addMonths(now, 1),
        quota: this.buildQuotaSnapshot(edition),
        usage: {},
        updatedBy: actor,
      }),
    );

    await this.createSubscriptionEvent({
      tenantId,
      eventType: 'subscription.initialized',
      detail: {
        editionId: created.editionId,
        plan: created.plan,
      },
      actor,
    });

    return created;
  }

  private async syncSubscriptionStatus(subscription: TenantSubscriptionEntity, actor: string) {
    const now = new Date();
    const previous = subscription.status;
    let next = previous;

    if (previous === 'trialing' && subscription.trialEndAt && subscription.trialEndAt <= now) {
      next = 'expired';
    }

    if (previous === 'active' && subscription.currentPeriodEndAt && subscription.currentPeriodEndAt <= now) {
      next = 'expired';
    }

    if (next === previous) {
      return subscription;
    }

    subscription.status = next;
    subscription.updatedBy = actor;

    const saved = await this.subscriptionRepository.save(subscription);

    await this.createSubscriptionEvent({
      tenantId: saved.tenantId,
      eventType: 'subscription.status-changed',
      detail: {
        from: previous,
        to: next,
      },
      actor,
    });

    return saved;
  }

  private async createSubscriptionEvent(input: {
    tenantId: string;
    eventType: string;
    detail: Record<string, unknown>;
    actor: string;
  }) {
    await this.subscriptionEventRepository.save(
      this.subscriptionEventRepository.create({
        tenantId: input.tenantId,
        eventType: input.eventType,
        detail: input.detail,
        createdBy: input.actor,
      }),
    );
  }

  private async getOverageStrategy(): Promise<OverageStrategy> {
    const row = await this.settingRepository.findOne({
      where: {
        scopeType: 'host',
        scopeId: 'host',
        key: OVERAGE_SETTING_KEY,
      },
    });

    const raw = row?.value;

    if (raw === 'degrade' || raw === 'reject') {
      return raw;
    }

    return 'reject';
  }

  private toSubscriptionView(
    subscription: TenantSubscriptionEntity,
    strategy: OverageStrategy,
  ): TenantSubscriptionView {
    const limit = this.getQuotaLimit(subscription, CAPABILITY_TASK_DISPATCH);
    const used = this.getUsageCount(subscription, CAPABILITY_TASK_DISPATCH);
    const unlimited = limit < 0;
    const exceeded = !unlimited && used >= limit;

    return {
      tenantId: subscription.tenantId,
      editionId: subscription.editionId,
      plan: subscription.plan,
      editionName: subscription.plan.toUpperCase(),
      status: subscription.status,
      trialStartAt: subscription.trialStartAt
        ? subscription.trialStartAt.toISOString()
        : null,
      trialEndAt: subscription.trialEndAt
        ? subscription.trialEndAt.toISOString()
        : null,
      currentPeriodStartAt: subscription.currentPeriodStartAt
        ? subscription.currentPeriodStartAt.toISOString()
        : null,
      currentPeriodEndAt: subscription.currentPeriodEndAt
        ? subscription.currentPeriodEndAt.toISOString()
        : null,
      overageStrategy: strategy,
      quota: {
        capabilityPoint: CAPABILITY_TASK_DISPATCH,
        limit,
        used,
        usageRate: this.calculateUsageRate(used, limit),
        exceeded,
        unlimited,
      },
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  private buildQuotaSnapshot(
    edition: EditionEntity,
    overrideTaskDispatchMonthly?: number,
  ): Record<string, number> {
    const quota = this.toNumberMap(edition.quota);

    if (quota[CAPABILITY_TASK_DISPATCH] === undefined) {
      quota[CAPABILITY_TASK_DISPATCH] =
        DEFAULT_MONTHLY_QUOTA[edition.plan] ?? DEFAULT_MONTHLY_QUOTA.free;
    }

    if (overrideTaskDispatchMonthly !== undefined) {
      quota[CAPABILITY_TASK_DISPATCH] = overrideTaskDispatchMonthly;
    }

    return quota;
  }

  private getQuotaLimit(subscription: TenantSubscriptionEntity, capabilityPoint: string) {
    const quota = this.toNumberMap(subscription.quota);
    const configured = quota[capabilityPoint];

    if (configured !== undefined) {
      return configured;
    }

    return DEFAULT_MONTHLY_QUOTA[subscription.plan] ?? 0;
  }

  private getUsageCount(subscription: TenantSubscriptionEntity, capabilityPoint: string) {
    const usage = this.toNumberMap(subscription.usage);
    return usage[capabilityPoint] ?? 0;
  }

  private toNumberMap(input: unknown): Record<string, number> {
    if (!input || typeof input !== 'object') {
      return {};
    }

    const result: Record<string, number> = {};

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        result[key] = value;
      }
    }

    return result;
  }

  private calculateUsageRate(used: number, limit: number) {
    if (limit < 0) {
      return 0;
    }

    if (limit === 0) {
      return 100;
    }

    return Number(((used / limit) * 100).toFixed(2));
  }

  private addDays(base: Date, days: number) {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  }

  private addMonths(base: Date, months: number) {
    const next = new Date(base);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private resolvePeriodStart(input?: string) {
    if (input) {
      const date = new Date(input);
      if (!Number.isNaN(date.getTime())) {
        return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
      }
    }

    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private toUsageMeterView(row: UsageMeterEntity): UsageMeterView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      capabilityPoint: row.capabilityPoint,
      totalUsed: row.totalUsed,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
