CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id varchar(64) PRIMARY KEY,
  user_id varchar(64) NOT NULL,
  tenant_id varchar(50) NOT NULL,
  token_hash varchar(128) NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  revoked_at timestamp NULL,
  replaced_by_token_id varchar(64) NULL,
  created_by_ip varchar(45) NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_tenant_user
  ON auth_refresh_tokens (tenant_id, user_id);
