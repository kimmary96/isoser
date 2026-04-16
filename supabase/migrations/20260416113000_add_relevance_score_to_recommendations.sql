ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS relevance_score FLOAT;
