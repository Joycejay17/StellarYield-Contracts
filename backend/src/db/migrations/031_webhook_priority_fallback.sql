-- Migration 031: Notification channel priority ordering (#1025) and
-- failure escalation to a fallback channel (#1024).

ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;

-- Nullable self-reference: the webhook to try after this one exhausts its retries.
ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS fallback_channel INT REFERENCES webhooks(id);

CREATE INDEX IF NOT EXISTS idx_webhooks_active_priority
  ON webhooks (priority, created_at DESC)
  WHERE active = TRUE;
