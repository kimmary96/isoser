CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'national_api',
  collection_method TEXT NOT NULL DEFAULT 'public_api',
  scope TEXT NOT NULL DEFAULT 'national',
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '기타',
  target TEXT[] DEFAULT '{}',
  region TEXT DEFAULT '전국',
  region_detail TEXT DEFAULT '',
  deadline DATE,
  link TEXT DEFAULT '',
  is_ad BOOLEAN DEFAULT FALSE,
  sponsor_name TEXT,
  embedding_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT programs_category_check
    CHECK (category IN ('AI', 'IT', '디자인', '경영', '창업', '기타')),
  CONSTRAINT programs_source_type_check
    CHECK (source_type IN ('national_api', 'seoul_city', 'quasi_public', 'local_gu')),
  CONSTRAINT programs_unique UNIQUE (title, source)
);

CREATE INDEX IF NOT EXISTS idx_programs_category ON programs(category);
CREATE INDEX IF NOT EXISTS idx_programs_deadline ON programs(deadline);
CREATE INDEX IF NOT EXISTS idx_programs_region_detail ON programs(region_detail);
CREATE INDEX IF NOT EXISTS idx_programs_scope ON programs(scope);
