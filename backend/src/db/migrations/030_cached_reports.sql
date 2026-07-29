CREATE TABLE IF NOT EXISTS cached_reports (
  id           SERIAL PRIMARY KEY,
  vault_id     INT NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  report_type  TEXT NOT NULL,
  report_year  INT NOT NULL,
  data         JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cached_reports_vault_type_year_key UNIQUE (vault_id, report_type, report_year)
);
