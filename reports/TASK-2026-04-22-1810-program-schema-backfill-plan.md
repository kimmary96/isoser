# Backfill Plan: TASK-2026-04-22-1810-program-schema-backfill

## purpose

고용24/K-Startup 수집 매핑 보강 이후, 운영 Supabase `programs` 테이블에 없는 컬럼과 기존 row의 빈 값을 별도 데이터 마이그레이션 작업으로 분리한다.

## schema check

2026-04-22 기준 운영 `programs` row의 실제 컬럼 목록에서 아래 컬럼은 존재한다.

- `compare_meta`
- `provider`
- `location`
- `description`
- `source_url`
- `start_date`
- `end_date`
- `cost`
- `subsidy_amount`

아래 컬럼은 migration 파일에는 있으나 운영 schema 조회 결과에는 없었다.

- `raw_data`
- `support_type`
- `teaching_method`
- `is_certified`

## why this is split

- 현재 collector scheduler는 Supabase PostgREST에 row payload를 직접 upsert한다.
- 운영 DB에 없는 컬럼을 payload에 넣으면 저장 전체가 실패할 수 있다.
- 따라서 수집 필드 보존 작업은 기존 컬럼과 `compare_meta`만 사용하고, 운영 schema 보강과 기존 row backfill은 별도 승인 task로 분리한다.

## recommended task scope

1. 운영 DB에 `raw_data`, `support_type`, `teaching_method`, `is_certified` 컬럼을 non-destructive migration으로 보강한다.
2. 기존 고용24/K-Startup row를 source별로 재수집 또는 live API match하여 `provider`, `location`, `description`, `start_date`, `end_date`, `source_url`, `compare_meta`를 backfill한다.
3. DB 업데이트 전후 row sample diff를 저장한다.
4. backfill 실패 row는 `program_id`, `source`, `title`, `reason` 기준으로 별도 리포트에 남긴다.

## risk

- 기존 row는 오래된 마감 공고가 많아 live source에서 다시 찾지 못할 수 있다.
- `title + source` dedupe 기반 row는 같은 제목의 회차/기수 공고가 섞일 수 있으므로, link/source_url/공고번호/고용24 hrd_id를 우선 match key로 써야 한다.
