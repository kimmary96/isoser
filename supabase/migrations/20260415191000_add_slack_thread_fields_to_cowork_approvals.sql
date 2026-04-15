ALTER TABLE IF EXISTS cowork_approvals
  ADD COLUMN IF NOT EXISTS slack_message_ts TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;
