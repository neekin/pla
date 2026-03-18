import { SetMetadata } from '@nestjs/common';

export const ENTITY_AUDIT_META_KEY = 'entity:audit';

export interface EntityAuditMeta {
  entityName: string;
  action: 'create' | 'update' | 'delete';
  payloadKey?: string;
}

export const EntityAudit = (meta: EntityAuditMeta) =>
  SetMetadata(ENTITY_AUDIT_META_KEY, meta);
