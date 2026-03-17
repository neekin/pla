import { Injectable } from '@nestjs/common';

export interface AuditLogRecord {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  tenantId: string;
  username: string;
  userId: string;
  ip: string;
}

@Injectable()
export class AuditLogService {
  private readonly maxRecords = 500;
  private readonly records: AuditLogRecord[] = [];

  addRecord(record: AuditLogRecord) {
    this.records.unshift(record);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }
  }

  list(limit = 100) {
    return this.records.slice(0, Math.min(limit, this.maxRecords));
  }
}
