CREATE TABLE IF NOT EXISTS workflow_runs (
  id VARCHAR(64) PRIMARY KEY,
  workflow_key VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_key_created_at
  ON workflow_runs (workflow_key, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id VARCHAR(64) PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_key VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run_created_at
  ON workflow_step_runs (run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workflow_event_log (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_event_log_type_created_at
  ON workflow_event_log (event_type, created_at DESC);
