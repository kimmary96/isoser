CREATE TABLE IF NOT EXISTS cowork_approvals (
  task_id TEXT PRIMARY KEY,
  target TEXT NOT NULL DEFAULT 'inbox',
  approved_by TEXT NOT NULL,
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'slack-interactivity',
  state TEXT NOT NULL DEFAULT 'requested',
  consumed_at TIMESTAMPTZ,
  consumed_by TEXT,
  consume_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cowork_approvals_target_check CHECK (target IN ('inbox', 'remote')),
  CONSTRAINT cowork_approvals_state_check CHECK (state IN ('requested', 'consumed', 'failed', 'ignored'))
);

CREATE INDEX IF NOT EXISTS idx_cowork_approvals_state_approved_at
  ON cowork_approvals (state, approved_at DESC);
