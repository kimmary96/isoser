---
id: TASK-2026-04-22-1800-program-source-field-mapping
status: queued
type: fix
title: 고용24 및 K-Startup 프로그램 수집 필드 매핑 보강
priority: high
planned_by: codex
planned_at: 2026-04-22T11:39:22+09:00
planned_against_commit: 8a93a4eb3a88d38e9fa46e9d4045b28e30a1428b
planned_files: backend/rag/collector/work24_collector.py, backend/rag/collector/kstartup_collector.py, backend/rag/collector/program_field_mapping.py, backend/rag/collector/normalizer.py, backend/tests/test_work24_kstartup_field_mapping.py, backend/tests/test_program_source_diff_cli.py, scripts/program_source_diff.py, cowork/packets/TASK-2026-04-22-1810-program-schema-backfill.md, reports/TASK-2026-04-22-1800-program-source-field-mapping-result.md, reports/TASK-2026-04-22-1810-program-schema-backfill-plan.md, docs/current-state.md, docs/refactoring-log.md
planned_worktree_fingerprint: 9689365e0936a51bdb4c6d6be882b03efa098ee3539a885f649411fa5dde4083
---
# Goal

고용24와 K-Startup 프로그램 수집 raw 응답에 존재하는 상세/기관/지역/일정/추적 필드가 정규화 단계에서 사라지는 문제를 최소 변경으로 보강한다.

# Constraints

- Prefer minimal safe changes.
- Reuse existing patterns before introducing new ones.
- 운영 DB에 없는 컬럼을 scheduler payload에 추가해 저장 실패를 만들지 않는다.
- 원본 raw 전체 저장 구조를 새로 만들지 않고, 이미 존재하는 `compare_meta` JSONB에 추적용 보조 필드를 보존한다.
- 상세/비교 화면이 현재 쓰는 `provider`, `location`, `description`, `start_date`, `end_date`, `source_url` 값을 우선 채운다.

# Acceptance Criteria

1. 고용24 collector가 주소, 기관명, 설명, 시작/종료일, 비용, 지원금, 원본 링크, NCS/전화/주말/만족도 등 추적 메타를 정규화 row까지 전달한다.
2. K-Startup collector가 기관명, 설명, 지역, 접수 시작/마감, 신청 링크, 전화, 사업분류, 대상 상세 등 추적 메타를 정규화 row까지 전달한다.
3. `normalizer.normalize()`는 기존 공통 필드 계약을 유지하면서 선택 확장 필드만 값이 있을 때 추가한다.
4. source별 field mapping을 중앙화한다.
5. 프로그램 ID 기준 raw → normalized → DB → API → UI diff CLI를 추가한다.
6. 운영 DB schema와 migration 차이를 확인하고 backfill task를 분리한다.
7. 고용24/K-Startup 매핑 및 diff CLI 회귀 테스트가 추가되고 통과한다.
8. 결과 보고서에 변경 이유, 영향 범위, 리스크, 테스트 포인트, 추가 리팩토링 후보를 남긴다.

# Edge Cases

- Missing runtime prerequisites
- Dirty worktree drift in the touched files

# Open Questions

- 운영 Supabase에 `support_type`, `teaching_method`, `raw_data` 컬럼이 migration과 달리 없을 수 있어 이번 변경에서는 직접 사용하지 않는다.
