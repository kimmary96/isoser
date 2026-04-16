ALTER TABLE IF EXISTS public.recommendations
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS fit_keywords TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

ALTER TABLE IF EXISTS public.recommendations
DROP CONSTRAINT IF EXISTS recommendations_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recommendations_user_query_program_unique'
  ) THEN
    ALTER TABLE public.recommendations
      ADD CONSTRAINT recommendations_user_query_program_unique
      UNIQUE (user_id, query_hash, program_id);
  END IF;
END
$$;
