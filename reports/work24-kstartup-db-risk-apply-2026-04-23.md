# Work24 / K-Startup DB Risk Apply

작성일: 2026-04-23

## Summary

| 항목 | 상태 | 결과 | 즉시 수정 우선순위 |
|---|---|---|---|
| Work24/K-Startup `source_unique_key` backfill | 확정 | 526건 적용, 실패 0건 | 상 |
| live source 기존 row 보강 | 확정 | 3,382건 patch 적용, 실패 0건 | 상 |
| live source 신규 row insert | 확정 | 48건 insert 완료 | 상 |
| HTML 계열 `source_unique_key` 보강 | 확정 | 110건 `urltitle:*` key로 재정렬, 최종 누락 0건 | 상 |
| Work24 실제 신청 마감일 복구 | 확정 | source에서 별도 마감일 신호를 확인하지 못해 broad deadline apply 보류 | 상 |
| 남은 신규 후보 2,560건 | 확정 | `programs_unique(title, source)` / legacy `hrd_id` unique 때문에 현재 DB에는 안전 insert 불가 | 상 |
| legacy unique 제거 migration | 확정 | `20260423143000_relax_programs_legacy_unique_constraints.sql` 추가. Supabase CLI/DB SQL 접속 부재로 운영 DB DDL 직접 적용은 미완료 | 상 |

## Applied DB Mutations

| 단계 | 대상 | 적용 | 실패 | 비고 |
|---|---:|---:|---:|---|
| Source identity backfill | 526 | 526 | 0 | Work24/K-Startup 기존 row의 `source_unique_key` 보강 |
| Existing live row patch | 3,382 | 3,382 | 0 | `compare_meta`, `raw_data`, `skills`, `description`, provider/location/date 일부 보강 |
| New live insert 1차 | 47 accepted | 31 | 16 | 16건은 `programs_category_check`로 실패 |
| New live insert retry | 17 | 17 | 0 | category를 DB 허용값으로 보정 후 재시도 |
| HTML source key rekey | 110 | 110 | 0 | `campus_town`, `sba_posting`, `seoul_50plus`, `seoul_job_portal`, `seoul_womanup`, `sesac` |

로컬 백업/결과 파일은 `.tmp_db_backup/` 아래에 저장했고 git에는 포함하지 않았다.

## Final DB Snapshot

Supabase REST 조회 기준이다.

| source | total | deadline_null | deadline_eq_end_date | close_date_present | has_application_deadline | has_training_end_date | has_recruitment_status | source_unique_key_missing | skills_empty | description_empty | raw_data_present |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| K-Startup 창업진흥원 | 306 | 0 | 290 | 0 | 0 | 0 | 290 | 0 | 43 | 16 | 290 |
| campus_town | 20 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 20 | 0 |
| sba_posting | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 10 | 0 |
| seoul_50plus | 28 | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 28 | 28 | 0 |
| seoul_job_portal | 10 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 10 | 0 |
| seoul_womanup | 18 | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 18 | 18 | 0 |
| sesac | 24 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 24 | 22 | 0 |
| work24_training | 47 | 47 | 0 | 0 | 0 | 0 | 0 | 0 | 47 | 0 | 0 |
| 고용24 | 3,391 | 3,331 | 0 | 0 | 0 | 3,140 | 0 | 0 | 2,274 | 55 | 3,140 |

전체 `programs` 기준 `source_unique_key` 누락은 0건이다.

## Remaining Blocker

| blocker | 영향 | 조치 |
|---|---|---|
| `programs_unique` unique `(title, source)` | 같은 제목의 Work24 다른 회차/기관 row가 insert되지 않는다. live candidate 2,560건이 여기서 보류됐다. | migration 적용 후 backfill/sync 재실행 |
| `programs_hrd_id_key`, `idx_programs_hrd_id_unique` | 같은 `trprId`의 다른 회차가 `source_unique_key`로 분리돼도 `hrd_id` unique에서 막힐 수 있다. | migration 적용 후 `source_unique_key`를 유일한 source identity로 사용 |
| Work24 application deadline 미노출 | deadline/calendar 추천은 계속 `마감일 미확인` 또는 제외 상태다. | Work24 별도 endpoint/상세 소스에서 신청기간 필드 확보 전까지 broad mutation 금지 |

## Executable SQL

운영 DB SQL Editor 또는 migration runner에서 먼저 적용한다.

```sql
alter table if exists public.programs
drop constraint if exists programs_unique;

alter table if exists public.programs
drop constraint if exists programs_hrd_id_key;

drop index if exists public.programs_unique;
drop index if exists public.programs_hrd_id_key;
drop index if exists public.idx_programs_hrd_id_unique;

create unique index if not exists idx_programs_source_unique_key
on public.programs(source_unique_key);

create index if not exists idx_programs_hrd_id
on public.programs(hrd_id)
where hrd_id is not null;

create index if not exists idx_programs_source_title
on public.programs(source, title);
```

적용 후 확인 SQL:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'programs'
  and (
    indexname ilike '%source_unique%'
    or indexname ilike '%programs_unique%'
    or indexname ilike '%hrd_id%'
  )
order by indexname;
```

## Next Safe Run

1. 위 migration을 운영 DB에 적용한다.
2. `source_unique_key_missing=0`을 재확인한다.
3. `scripts/program_backfill.py` live preview로 신규 후보/patch 후보를 다시 확인한다.
4. `--apply`로 2,560건 보류 후보를 재시도한다.
5. Work24 deadline은 `application_deadline`이 실제로 잡히는 source 샘플이 나오기 전까지 수정하지 않는다.

## Verification

| 검증 | 결과 |
|---|---|
| DB recount via Supabase REST | `TOTAL_ROWS=3854`, `SOURCE_UNIQUE_MISSING_TOTAL=0` |
| Targeted backend tests | `23 passed` |
| Supabase CLI availability | 미설치. 운영 DDL 직접 적용 불가 |
