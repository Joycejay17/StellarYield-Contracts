-- Migration 032: Notification templates, used to render an event notification
-- into a channel-specific message body. Backs the preview endpoint (#1026).

CREATE TABLE IF NOT EXISTS notification_templates (
  id            SERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,
  channel       TEXT NOT NULL,
  body_template TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notification_templates_event_channel_key UNIQUE (event_type, channel)
);

INSERT INTO notification_templates (event_type, channel, body_template, active) VALUES
  ('deposit', 'webhook',
   'Deposit of {{data.amount}} into vault {{data.contractId}} by {{data.address}}.', TRUE),
  ('yield_distributed', 'webhook',
   'Vault {{data.contractId}} distributed {{data.amount}} of yield for epoch {{data.epoch}}.', TRUE),
  ('vault_state_changed', 'webhook',
   'Vault {{data.contractId}} moved to state {{data.state}}.', TRUE)
ON CONFLICT (event_type, channel) DO NOTHING;
