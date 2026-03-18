CREATE TABLE IF NOT EXISTS abac_policy_rules (
  id VARCHAR(64) PRIMARY KEY,
  policy_key VARCHAR(120) NOT NULL,
  effect VARCHAR(10) NOT NULL,
  subject_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  resource_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  field_masks JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_abac_policy_rules_policy_key
  ON abac_policy_rules (policy_key);
