CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  similarity_score FLOAT DEFAULT 0,
  urgency_score FLOAT DEFAULT 0,
  final_score FLOAT DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT recommendations_unique UNIQUE (user_id, program_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT bookmarks_unique UNIQUE (user_id, program_id)
);
