-- rollback: week5 workflow run persistence + task retry strategy templates

ALTER TABLE platform_tasks
  DROP COLUMN IF EXISTS retry_base_delay_ms,
  DROP COLUMN IF EXISTS retry_strategy;

DROP INDEX IF EXISTS idx_workflow_step_runs_status_created_at;
DROP INDEX IF EXISTS idx_workflow_step_runs_run_id_step_key;
DROP TABLE IF EXISTS workflow_step_runs;

DROP INDEX IF EXISTS idx_workflow_runs_status_updated_at;
DROP INDEX IF EXISTS idx_workflow_runs_workflow_key_created_at;
DROP TABLE IF EXISTS workflow_runs;
