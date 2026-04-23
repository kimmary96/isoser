---
id: TASK-2026-04-24-1030-program-list-followup-hardening
status: queued
type: fix/update
title: Program list follow-up hardening for promotion model and query contracts
priority: high
planned_by: codex
planned_at: 2026-04-24T10:30:00+09:00
planned_against_commit: 3d973498973065c2427585631e836ee33fad5954
planned_files: backend/routers/programs.py, backend/tests/test_programs_router.py, frontend/lib/types/index.ts, frontend/app/(landing)/programs/page.tsx, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-24-1030-program-list-followup-hardening-result.md
---

# Goal

현재 read-model 기반 `/programs` 목록의 후속 정합성 이슈를 작게 정리한다.
사용자가 보는 목록 동작은 유지하면서 promoted layer 계약과 query/filter 계약을 더 명확하게 만든다.

# Scope

- browse 1페이지 promoted layer와 organic layer 계약을 재점검한다.
- organic 결과와 promoted 결과의 중복 노출 방어를 테스트로 고정한다.
- read-model query/filter/cursor 조합의 남은 취약 지점을 작은 수정으로 보강한다.
- 관련 결과를 `docs/current-state.md`, `docs/refactoring-log.md`, result report에 반영한다.

# Acceptance Criteria

1. promoted layer 계약이 코드와 타입에서 명확히 유지된다.
2. organic 결과와 promoted 결과가 중복 노출되지 않는다.
3. read-model query/filter/cursor 조합 관련 테스트가 보강된다.
4. 기존 `/programs` 사용자 동작은 유지된다.
5. 결과는 result report와 current-state에 반영된다.

# Constraints

- 기존 동작 유지가 우선이다.
- 외부 검색 엔진은 도입하지 않는다.
- 큰 구조 개편보다 query contract와 테스트 보강을 우선한다.
- 현재 offset 기반 UX를 함부로 뒤집지 않는다.

# Non-goals

- 새로운 광고 운영 콘솔 구축
- 대규모 pagination UX 재설계
- Supabase migration 추가를 전제로 한 큰 스키마 확장

# Test Points

- promoted/organic dedupe
- browse 1페이지 promoted layer 노출
- search/filter 조합 시 read-model path 유지
- `backend/tests/test_programs_router.py`
- 필요 시 frontend 타입 체크

# Risks

- PostgREST boolean expression 조합 수정 시 회귀 위험이 있다.
- promoted fallback 가정이 실제 광고 정책과 다를 수 있다.

# Follow-up Refactoring Candidates

- real `program_promotions` 테이블 도입
- read-model query builder helper 분리
- exact count/facet snapshot 전략 정리
