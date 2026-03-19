import { Injectable } from '@nestjs/common';

export type OpsAlertSeverity = 'critical' | 'warning' | 'info';
export type OpsAlertStatus = 'open' | 'investigating' | 'mitigated' | 'resolved';

export interface OpsAlertEvent {
  id: string;
  alertName: string;
  severity: OpsAlertSeverity;
  source: string;
  status: OpsAlertStatus;
  summary: string;
  description: string;
  runbookId: string;
  ticket: {
    id: string;
    system: 'incident';
    url: string;
    status: 'open' | 'in-progress' | 'resolved';
  };
  oncallTrail: Array<{
    stage: 'primary' | 'secondary' | 'duty-manager';
    owner: string;
    status: 'notified' | 'acknowledged' | 'escalated' | 'resolved';
    at: string;
    note?: string;
  }>;
  context?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class OpsAlertService {
  private readonly maxRecords = 500;
  private readonly events: OpsAlertEvent[] = [];

  raiseAlert(input: {
    alertName: string;
    severity: OpsAlertSeverity;
    source: string;
    summary: string;
    description: string;
    runbookId: string;
    context?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const id = `alert_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const ticketId = this.generateTicketId();

    const event: OpsAlertEvent = {
      id,
      alertName: input.alertName,
      severity: input.severity,
      source: input.source,
      status: 'open',
      summary: input.summary,
      description: input.description,
      runbookId: input.runbookId,
      ticket: {
        id: ticketId,
        system: 'incident',
        url: `https://ops.example.local/incidents/${ticketId}`,
        status: 'open',
      },
      oncallTrail: [
        {
          stage: 'primary',
          owner: 'oncall-primary',
          status: 'notified',
          at: now,
          note: '告警已通知主值班并自动创建故障工单',
        },
      ],
      context: input.context,
      createdAt: now,
      updatedAt: now,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxRecords) {
      this.events.pop();
    }

    return event;
  }

  list(input?: {
    severity?: OpsAlertSeverity;
    status?: OpsAlertStatus;
    alertName?: string;
    ticketId?: string;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(input?.limit ?? 100, 1), this.maxRecords);

    return this.events
      .filter((item) => {
        if (input?.severity && item.severity !== input.severity) {
          return false;
        }

        if (input?.status && item.status !== input.status) {
          return false;
        }

        if (input?.alertName && !item.alertName.includes(input.alertName)) {
          return false;
        }

        if (input?.ticketId && !item.ticket.id.includes(input.ticketId)) {
          return false;
        }

        return true;
      })
      .slice(0, limit);
  }

  private generateTicketId() {
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const suffix = Math.random().toString().slice(2, 8);
    return `INC-${stamp}-${suffix}`;
  }
}
