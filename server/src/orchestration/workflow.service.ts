import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WorkflowRunEntity } from '../database/entities/workflow-run.entity';
import { WorkflowStepRunEntity } from '../database/entities/workflow-step-run.entity';
import { EventBusService } from './event-bus.service';

export interface WorkflowStepTemplate {
  key: string;
  action: 'emit_event' | 'wait';
  retryAttempts?: number;
  retryDelayMs?: number;
  compensateWith?: 'emit_event';
  eventType?: string;
  compensationEventType?: string;
  waitMs?: number;
}

export interface WorkflowTemplate {
  key: string;
  name: string;
  description: string;
  steps: WorkflowStepTemplate[];
}

export interface WorkflowRunResult {
  runId: string;
  workflowKey: string;
  status: 'running' | 'done' | 'failed';
  payload: Record<string, unknown>;
  stepRuns: Array<{
    stepKey: string;
    status: 'done' | 'failed' | 'compensated';
    attempts: number;
    errorMessage: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class WorkflowService {
  private readonly templates: WorkflowTemplate[] = [
    {
      key: 'tenant.onboarding.v1',
      name: '租户开通编排',
      description: '跨模块开通流程（创建默认配置、初始化配额、发通知）',
      steps: [
        {
          key: 'tenant.validate',
          action: 'emit_event',
          eventType: 'tenant.onboarding.validate',
          retryAttempts: 1,
          compensateWith: 'emit_event',
          compensationEventType: 'tenant.onboarding.rollback.validate',
        },
        {
          key: 'tenant.bootstrap',
          action: 'emit_event',
          eventType: 'tenant.onboarding.bootstrap',
          retryAttempts: 2,
          retryDelayMs: 300,
          compensateWith: 'emit_event',
          compensationEventType: 'tenant.onboarding.rollback.bootstrap',
        },
        {
          key: 'tenant.notify',
          action: 'emit_event',
          eventType: 'tenant.onboarding.notify',
          retryAttempts: 2,
        },
      ],
    },
  ];

  constructor(
    private readonly eventBus: EventBusService,
    @InjectRepository(WorkflowRunEntity)
    private readonly workflowRunRepository: Repository<WorkflowRunEntity>,
    @InjectRepository(WorkflowStepRunEntity)
    private readonly workflowStepRunRepository: Repository<WorkflowStepRunEntity>,
  ) {}

  listTemplates() {
    return this.templates;
  }

  async listRuns(limit = 50) {
    const normalizedLimit = Math.min(200, Math.max(1, limit));
    const runs = await this.workflowRunRepository.find({
      order: { createdAt: 'DESC' },
      take: normalizedLimit,
    });

    if (runs.length === 0) {
      return [];
    }

    const runIds = runs.map((item) => item.id);
    const stepRows = await this.workflowStepRunRepository.find({
      where: { runId: In(runIds) },
      order: { createdAt: 'ASC' },
    });

    const stepByRunId = new Map<string, WorkflowStepRunEntity[]>();
    for (const stepRow of stepRows) {
      const list = stepByRunId.get(stepRow.runId) ?? [];
      list.push(stepRow);
      stepByRunId.set(stepRow.runId, list);
    }

    return runs.map((row) => ({
      runId: row.id,
      workflowKey: row.workflowKey,
      status: row.status,
      payload: row.payload,
      stepRuns: (stepByRunId.get(row.id) ?? []).map((step) => ({
        stepKey: step.stepKey,
        status: step.status,
        attempts: step.attempts,
        errorMessage: step.errorMessage,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })) satisfies WorkflowRunResult[];
  }

  async runWorkflow(input: {
    workflowKey: string;
    payload?: Record<string, unknown>;
    triggerBy?: string;
  }): Promise<WorkflowRunResult> {
    const template = this.templates.find((item) => item.key === input.workflowKey);

    if (!template) {
      throw new NotFoundException('Workflow template not found');
    }

    const runId = randomUUID();
    const createdAt = new Date().toISOString();
    const payload = input.payload ?? {};
    const stepRuns: WorkflowRunResult['stepRuns'] = [];
    const completedSteps: WorkflowStepTemplate[] = [];

    const runRow = await this.workflowRunRepository.save(
      this.workflowRunRepository.create({
        id: runId,
        workflowKey: template.key,
        status: 'running',
        payload,
        triggerBy: input.triggerBy ?? 'system',
      }),
    );

    try {
      for (const step of template.steps) {
        const execution = await this.executeStep({
          runId,
          step,
          payload,
          triggerBy: input.triggerBy ?? 'system',
        });

        stepRuns.push(execution);

        await this.workflowStepRunRepository.save(
          this.workflowStepRunRepository.create({
            runId,
            stepKey: execution.stepKey,
            status: execution.status,
            attempts: execution.attempts,
            errorMessage: execution.errorMessage,
            stepContext: {
              action: step.action,
              eventType: step.eventType ?? null,
              compensateWith: step.compensateWith ?? null,
            },
          }),
        );

        if (execution.status === 'failed') {
          throw new Error(execution.errorMessage ?? `${step.key} failed`);
        }

        completedSteps.push(step);
      }

      const result: WorkflowRunResult = {
        runId,
        workflowKey: template.key,
        status: 'done',
        payload,
        stepRuns,
        createdAt,
        updatedAt: new Date().toISOString(),
      };

      runRow.status = 'done';
      await this.workflowRunRepository.save(runRow);
      return result;
    } catch (error) {
      const compensated = await this.compensateCompletedSteps({
        runId,
        payload,
        completedSteps,
        triggerBy: input.triggerBy ?? 'system',
      });

      for (const step of compensated) {
        stepRuns.push(step);
      }

      const result: WorkflowRunResult = {
        runId,
        workflowKey: template.key,
        status: 'failed',
        payload,
        stepRuns,
        createdAt,
        updatedAt: new Date().toISOString(),
      };

      runRow.status = 'failed';
      await this.workflowRunRepository.save(runRow);
      return result;
    }
  }

  private async executeStep(input: {
    runId: string;
    step: WorkflowStepTemplate;
    payload: Record<string, unknown>;
    triggerBy: string;
  }): Promise<WorkflowRunResult['stepRuns'][number]> {
    const retryAttempts = Math.max(1, input.step.retryAttempts ?? 1);
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        if (input.payload.forceFailStep === input.step.key) {
          throw new Error('WORKFLOW_STEP_FORCED_FAILURE');
        }

        if (input.step.action === 'emit_event' && input.step.eventType) {
          await this.eventBus.publish({
            type: input.step.eventType,
            source: 'workflow-engine',
            payload: {
              runId: input.runId,
              stepKey: input.step.key,
              triggerBy: input.triggerBy,
              ...input.payload,
            },
          });
        }

        if (input.step.action === 'wait') {
          await sleep(input.step.waitMs ?? 100);
        }

        return {
          stepKey: input.step.key,
          status: 'done',
          attempts: attempt,
          errorMessage: null,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        if (attempt < retryAttempts) {
          await sleep(input.step.retryDelayMs ?? 200);
        }
      }
    }

    return {
      stepKey: input.step.key,
      status: 'failed',
      attempts: retryAttempts,
      errorMessage: lastError,
    };
  }

  private async compensateCompletedSteps(input: {
    runId: string;
    payload: Record<string, unknown>;
    completedSteps: WorkflowStepTemplate[];
    triggerBy: string;
  }) {
    const compensatedSteps: WorkflowRunResult['stepRuns'] = [];

    for (const step of [...input.completedSteps].reverse()) {
      if (step.compensateWith !== 'emit_event' || !step.compensationEventType) {
        continue;
      }

      await this.eventBus.publish({
        type: step.compensationEventType,
        source: 'workflow-engine',
        payload: {
          runId: input.runId,
          stepKey: step.key,
          triggerBy: input.triggerBy,
          ...input.payload,
        },
      });

      await this.workflowStepRunRepository.save(
        this.workflowStepRunRepository.create({
          runId: input.runId,
          stepKey: `${step.key}.compensation`,
          status: 'compensated',
          attempts: 1,
          errorMessage: null,
          stepContext: {
            compensationEventType: step.compensationEventType,
          },
        }),
      );

      compensatedSteps.push({
        stepKey: `${step.key}.compensation`,
        status: 'compensated',
        attempts: 1,
        errorMessage: null,
      });
    }

    return compensatedSteps;
  }
}

function sleep(durationMs: number) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, Math.max(0, durationMs));
  });
}
