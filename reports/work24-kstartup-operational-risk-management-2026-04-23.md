# Work24 / K-Startup Operational Risk Management

작성일: 2026-04-23

## Current DB Snapshot

읽기 전용 Supabase REST 조회 기준입니다. 비밀값은 출력하지 않았습니다.

| source | total | deadline_null | deadline_eq_end_date | close_date_present | has_application_deadline | source_unique_key_missing | skills_empty | description_empty | raw_data_present |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 고용24 | 3359 | 3299 | 0 | 0 | 0 | 189 | 3359 | 58 | 0 |
| work24_training | 47 | 47 | 0 | 0 | 0 | 47 | 47 | 0 | 0 |
| K-Startup 창업진흥원 | 290 | 0 | 15 | 0 | 0 | 290 | 290 | 275 | 0 |

## Dry-Run Findings

| Check | Result | Decision |
|---|---|---|
| `scripts.program_backfill.build_work24_deadline_audit_report(limit=5000)` | `candidate_count=2`, `suspect_count=0` | 기존 Work24 `deadline=end_date` 오염값은 현재 DB에서 대부분 `NULL`로 격리된 상태다. |
| `scripts.program_backfill.build_program_deadline_audit_report(limit=5000)` | `candidate_count=1019`, `suspect_count=1015`, `active_row_without_recruiting_deadline=1000`, `deadline_equals_end_date_review=15` | 남은 주요 리스크는 실제 모집 마감일 미복구다. |
| Work24 `deadline is null` 상세 페이지 샘플 10건 | detail fetch `10/10` 성공, patch `10/10`, deadline patch `0/10`, compare_meta patch `10/10` | 지금 broad `--apply`를 실행해도 핵심 deadline 리스크는 거의 줄지 않는다. compare_meta 보강은 가능하지만 별도 단계로 분리한다. |

## Risk Register

| Risk | Impact | Current Control | Remaining Action | Priority |
|---|---|---|---|---|
| Work24 actual recruitment deadline missing | 비교 모달, 추천 캘린더, D-day에서 Work24 후보가 줄거나 `마감일 미확인`으로 표시됨 | backend resolved deadline guard and UI unknown state | source가 제공하는 신청기간 확보 방식 재검토. 현재 HTML 샘플은 deadline 미노출 | 상 |
| Work24 / K-Startup `source_unique_key` missing | fresh sync 시 legacy row update 대신 duplicate insert 가능 | scheduler prefers `source_unique_key` when present | apply source_unique_key backfill before any broad source sync | 상 |
| Skills/raw_data empty | 검색/추천 품질 저하, 원본 감사 어려움 | new collectors can emit `skills` and `raw_data` | source_unique_key backfill 후 fresh sync or targeted backfill | 상 |
| K-Startup description mostly empty | 비교/상세 품질 저하 | new mapper can preserve description when source returns it | targeted K-Startup resync after identity backfill | 중 |
| Backend candidate scan widened | DB read volume and latency can increase | scan limit bounded by `PROGRAM_SEARCH_SCAN_LIMIT` | monitor `/programs` and `/programs/count` latency after deploy | 중 |
| `cost_type` / `participation_time` schema drift | filter DB columns unavailable in current SQL snapshot | backend text fallback exists | confirm/apply migration separately | 중 |

## Safe Operating Sequence

1. Backup affected rows.
2. Backfill `source_unique_key` only, with duplicate guard.
3. Recount duplicates and missing identity keys.
4. Run source resync/backfill only after identity keys are stable.
5. Run Work24 detail backfill in small batches and inspect deadline patch rate before any broad apply.
6. Monitor API latency and unresolved deadline counts after deploy.

## Backup SQL

```sql
create table if not exists public.programs_risk_backup_20260423 as
select *
from public.programs
where source in ('고용24', 'work24_training', 'K-Startup 창업진흥원');
```

## Source Unique Key Preview SQL

```sql
with work24_candidates as (
  select
    id,
    source,
    'work24:'
      || coalesce(hrd_id, compare_meta->>'hrd_id', substring(coalesce(source_url, link, compare_meta->>'source_url', '') from '[?&]tracseId=([^&]+)'))
      || ':'
      || coalesce(compare_meta->>'trpr_degr', compare_meta->>'tracse_tme', substring(coalesce(source_url, link, compare_meta->>'source_url', '') from '[?&]tracseTme=([^&]+)'))
      || ':'
      || coalesce(compare_meta->>'trainst_cstmr_id', substring(coalesce(source_url, link, compare_meta->>'source_url', '') from '[?&]trainstCstmrId=([^&]+)'))
      as candidate_key
  from public.programs
  where source in ('고용24', 'work24_training')
    and source_unique_key is null
),
kstartup_candidates as (
  select
    id,
    source,
    'kstartup:'
      || coalesce(compare_meta->>'announcement_id', compare_meta->>'pbanc_sn', substring(coalesce(source_url, link, '') from '[?&]pbancSn=([^&]+)'))
      as candidate_key
  from public.programs
  where source = 'K-Startup 창업진흥원'
    and source_unique_key is null
),
candidates as (
  select * from work24_candidates
  union all
  select * from kstartup_candidates
)
select source, count(*) as candidate_count
from candidates
where candidate_key is not null
  and candidate_key not like '%::%'
  and not exists (
    select 1
    from public.programs existing
    where existing.source_unique_key = candidates.candidate_key
      and existing.id <> candidates.id
  )
group by source
order by source;
```

## Source Unique Key Apply SQL

```sql
with work24_candidates as (
  select
    id,
    'work24:'
      || coalesce(hrd_id, compare_meta->>'hrd_id', substring(coalesce(source_url, link, compare_meta->>'source_url', '') from '[?&]tracseId=([^&]+)'))
      || ':'
      || coalesce(compare_meta->>'trpr_degr', compare_meta->>'tracse_tme', substring(coalesce(source_url, link, compare_meta->>'source_url', '') from '[?&]tracseTme=([^&]+)'))
      || ':'
      || coalesce(compare_meta->>'trainst_cstmr_id', substring(coalesce(source_url, link, compare_meta->>'source_url', '') from '[?&]trainstCstmrId=([^&]+)'))
      as candidate_key
  from public.programs
  where source in ('고용24', 'work24_training')
    and source_unique_key is null
),
kstartup_candidates as (
  select
    id,
    'kstartup:'
      || coalesce(compare_meta->>'announcement_id', compare_meta->>'pbanc_sn', substring(coalesce(source_url, link, '') from '[?&]pbancSn=([^&]+)'))
      as candidate_key
  from public.programs
  where source = 'K-Startup 창업진흥원'
    and source_unique_key is null
),
candidates as (
  select * from work24_candidates
  union all
  select * from kstartup_candidates
),
safe_candidates as (
  select *
  from candidates
  where candidate_key is not null
    and candidate_key not like '%::%'
    and not exists (
      select 1
      from public.programs existing
      where existing.source_unique_key = candidates.candidate_key
        and existing.id <> candidates.id
    )
)
update public.programs p
set source_unique_key = safe_candidates.candidate_key
from safe_candidates
where p.id = safe_candidates.id
returning p.id, p.source, p.source_unique_key;
```

## Post-Apply Verification SQL

```sql
select
  source,
  count(*) as total,
  count(*) filter (where source_unique_key is null) as source_unique_key_missing,
  count(*) filter (where deadline is null) as deadline_null,
  count(*) filter (where close_date is not null) as close_date_present,
  count(*) filter (where compare_meta ? 'application_deadline') as has_application_deadline,
  count(*) filter (where coalesce(array_length(skills, 1), 0) = 0) as skills_empty,
  count(*) filter (where raw_data is not null) as raw_data_present
from public.programs
where source in ('고용24', 'work24_training', 'K-Startup 창업진흥원')
group by source
order by source;
```

## Rollback SQL

```sql
update public.programs p
set
  source_unique_key = b.source_unique_key,
  deadline = b.deadline,
  close_date = b.close_date,
  compare_meta = b.compare_meta,
  skills = b.skills,
  tags = b.tags,
  raw_data = b.raw_data,
  updated_at = b.updated_at
from public.programs_risk_backup_20260423 b
where p.id = b.id;
```

## Go / No-Go

| Step | Go Condition | No-Go Condition |
|---|---|---|
| source_unique_key apply | Preview candidate count is close to current missing count and duplicate guard excludes conflicts | Preview count is unexpectedly low or conflicts appear |
| source sync/backfill | Missing source_unique_key count is near zero | Identity keys still missing, because sync may create duplicates |
| Work24 detail apply | Small batch shows meaningful `deadline` or `close_date` patch rate | Only compare_meta patch appears, as in current 10-row sample |
| broad deadline mutation | Never run without verified source deadline | HTML/API source still does not expose recruitment deadline |

## Current Decision

Do not run broad DB apply for Work24 deadline recovery yet. The safe next mutation is identity-key backfill with backup and duplicate guard, then source resync/backfill for skills/raw_data. Deadline recovery needs a better source signal than the current sampled Work24 detail HTML exposes.
