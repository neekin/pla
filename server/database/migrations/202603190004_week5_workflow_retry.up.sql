-- Week5: workflow run persistence + task retry strategy templates

CREATE TABLE IF NOT EXISTS workflow_runs (
  id VARCHAR(64) PRIMARY KEY,
  workflow_key VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL,
  trigger_by VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_key_created_at
  ON workflow_runs (workflow_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status_updated_at
  ON workflow_runs (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(64) NOT NULL,
  step_key VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  attempts INT NOT NULL,
  error_message VARCHAR(500) NULL,
  step_context JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_workflow_step_runs_run_id
    FOREIGN KEY (run_id)
    REFERENCES workflow_runs(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run_id_step_key
  ON workflow_step_runs (run_id, step_key);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_status_created_at
  ON workflow_step_runs (status, created_at DESC);

ALTER TABLE platform_tasks
  ADD COLUMN IF NOT EXISTS retry_strategy VARCHAR(20) NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS retry_base_delay_ms INT NOT NULL DEFAULT 30000;
