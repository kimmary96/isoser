-- cover_letters에 문항/답변 배열 컬럼 추가

alter table public.cover_letters
add column if not exists qa_items jsonb not null default '[]'::jsonb;
