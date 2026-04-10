-- profiles 테이블에 포트폴리오 링크 컬럼 추가
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS portfolio_url text;
