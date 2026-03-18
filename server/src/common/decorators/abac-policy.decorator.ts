import { SetMetadata } from '@nestjs/common';

export const ABAC_POLICY_KEY = 'abac:policy';

export const AbacPolicy = (policyKey: string) => SetMetadata(ABAC_POLICY_KEY, policyKey);
