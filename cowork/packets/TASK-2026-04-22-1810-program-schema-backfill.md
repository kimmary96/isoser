---
id: TASK-2026-04-22-1810-program-schema-backfill
status: queued
type: data-migration
title: 프로그램 운영 DB 스키마 보강 및 source 필드 backfill 분리
priority: high
planned_by: codex
planned_at: 2026-04-22T11:48:41+09:00
planned_against_commit: 8a93a4eb3a88d38e9fa46e9d4045b28e30a1428b
planned_files: supabase/migrations, backend/routers/admin.py, backend/rag/collector, scripts, reports, docs/current-state.md, docs/refactoring-log.md
planned_worktree_fingerprint: da1ed69a9ec2def1b998b685b81ca9513b3bc7ae477ae9e1fee3266f8791f593
---
# Goal

운영 Supabase `programs` 테이블의 실제 schema와 migration 차이를 해소하고, 고용24/K-Startup 기존 row에 대해 source field backfill을 수행한다.

# Constraints

- Prefer minimal safe changes.
- Reuse existing patterns before introducing new ones.
- 이번 task는 `TASK-2026-04-22-1800-program-source-field-mapping` 이후 별도로 실행한다.
- 기존 row 삭제 또는 전체 테이블 재작성 금지.
- backfill 전/후 diff를 프로그램 단위로 남긴다.
- live source에서 match되지 않는 row는 실패로 덮어쓰지 말고 별도 report에 남긴다.

# Acceptance Criteria

1. 운영 DB에 없는 `raw_data`, `support_type`, `teaching_method`, `is_certified` 컬럼을 non-destructive migration으로 보강한다.
2. 고용24/K-Startup 기존 row 중 source raw와 안전하게 매칭되는 row에 `provider`, `location`, `description`, `start_date`, `end_date`, `source_url`, `compare_meta`를 backfill한다.
3. `program_id` 기준 before/after diff report를 생성한다.
4. 실패 row는 `program_id`, `source`, `title`, `reason`을 포함해 별도 report에 남긴다.
5. backfill은 dry-run 모드를 먼저 지원한다.

# Edge Cases

- Missing runtime prerequisites
- Dirty worktree drift in the touched files

# Open Questions

- 운영 DB schema check 결과 `raw_data`, `support_type`, `teaching_method`, `is_certified`가 누락되어 있다. 근거: `reports/TASK-2026-04-22-1810-program-schema-backfill-plan.md`
