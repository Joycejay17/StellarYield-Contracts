-- Issue #803: Add emergency flag to vaults for compliance tracking
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS emergency BOOLEAN NOT NULL DEFAULT FALSE;

-- Issue #803: Blacklisted addresses per vault
CREATE TABLE IF NOT EXISTS vault_blacklisted_addresses (
  id              SERIAL PRIMARY KEY,
  vault_id        INT NOT NULL REFERENCES vaults(id),
  address         TEXT NOT NULL,
  added_by        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (vault_id, address)
);

CREATE INDEX IF NOT EXISTS idx_vault_blacklisted_vault_id ON vault_blacklisted_addresses(vault_id);

-- Issue #804: Key/value config table for runtime-configurable settings
CREATE TABLE IF NOT EXISTS app_config (
  key             TEXT PRIMARY KEY,
  value           TEXT NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES
  ('eventsRetentionDays', '90'),
  ('positionRetentionDays', '365'),
  ('auditLogRetentionDays', '365')
ON CONFLICT (key) DO NOTHING;
