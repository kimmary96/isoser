ALTER TABLE IF EXISTS public.recommendations
ADD COLUMN IF NOT EXISTS query_hash TEXT,
ADD COLUMN IF NOT EXISTS profile_hash TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recommendations_query_hash
ON public.recommendations(query_hash);

CREATE INDEX IF NOT EXISTS idx_recommendations_profile_hash
ON public.recommendations(profile_hash);

CREATE INDEX IF NOT EXISTS idx_recommendations_expires_at
ON public.recommendations(expires_at);

CREATE INDEX IF NOT EXISTS idx_recommendations_user_query_hash
ON public.recommendations(user_id, query_hash);
