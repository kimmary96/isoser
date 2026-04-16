CREATE TABLE IF NOT EXISTS public.recommendation_rules (
  id BIGSERIAL PRIMARY KEY,
  condition_key TEXT UNIQUE NOT NULL,
  program_ids TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  reason_template TEXT,
  fit_keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_rules_condition
ON public.recommendation_rules(condition_key);

CREATE INDEX IF NOT EXISTS idx_recommendation_rules_priority
ON public.recommendation_rules(priority DESC, created_at DESC);
