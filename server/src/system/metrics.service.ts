import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDurationMs: Histogram<string>;
  readonly taskQueueGauge: Gauge<string>;
  readonly taskFailureTotal: Counter<string>;
  readonly authLoginSuccessRate: Gauge<string>;
  readonly taskSuccessRate: Gauge<string>;
  readonly billingReconcileErrorTotal: Counter<string>;

  private authLoginAttempts = 0;
  private authLoginSuccesses = 0;
  private taskExecutionAttempts = 0;
  private taskExecutionSuccesses = 0;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    this.taskQueueGauge = new Gauge({
      name: 'task_queue_length',
      help: 'Number of tasks per status',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.taskFailureTotal = new Counter({
      name: 'task_failures_total',
      help: 'Total number of task failures',
      registers: [this.registry],
    });

    this.authLoginSuccessRate = new Gauge({
      name: 'auth_login_success_rate',
      help: 'Auth login success rate (0-1)',
      registers: [this.registry],
    });

    this.taskSuccessRate = new Gauge({
      name: 'task_success_rate',
      help: 'Task execution success rate (0-1)',
      registers: [this.registry],
    });

    this.billingReconcileErrorTotal = new Counter({
      name: 'billing_reconcile_error_total',
      help: 'Total billing reconciliation errors requiring compensation',
      registers: [this.registry],
    });

    this.authLoginSuccessRate.set(0);
    this.taskSuccessRate.set(0);
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordRequest(method: string, path: string, status: number, durationMs: number) {
    const labels = { method, path: this.normalizePath(path), status: String(status) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationMs.observe(labels, durationMs);
  }

  setTaskQueueLength(status: string, count: number) {
    this.taskQueueGauge.set({ status }, count);
  }

  incTaskFailure() {
    this.taskFailureTotal.inc();
  }

  recordAuthLogin(success: boolean) {
    this.authLoginAttempts += 1;
    if (success) {
      this.authLoginSuccesses += 1;
    }

    const rate =
      this.authLoginAttempts > 0
        ? this.authLoginSuccesses / this.authLoginAttempts
        : 0;

    this.authLoginSuccessRate.set(Number(rate.toFixed(6)));
  }

  recordTaskExecution(success: boolean) {
    this.taskExecutionAttempts += 1;
    if (success) {
      this.taskExecutionSuccesses += 1;
    }

    const rate =
      this.taskExecutionAttempts > 0
        ? this.taskExecutionSuccesses / this.taskExecutionAttempts
        : 0;

    this.taskSuccessRate.set(Number(rate.toFixed(6)));
  }

  addBillingReconcileErrors(count: number) {
    const normalized = Math.max(0, Math.floor(count));

    if (normalized === 0) {
      return;
    }

    this.billingReconcileErrorTotal.inc(normalized);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Normalise dynamic path segments so cardinality stays low */
  private normalizePath(path: string): string {
    // Strip query string
    const pathOnly = path.split('?')[0];
    // Replace UUIDs and numeric IDs with :id
    return pathOnly
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
