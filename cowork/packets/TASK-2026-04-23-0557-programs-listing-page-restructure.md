---
id: TASK-2026-04-23-0557-programs-listing-page-restructure
status: queued
type: fix
title: 프로그램 목록 페이지 구조 개편 잔여 검증 및 보완
priority: P2
planned_by: Codex (replan after drift)
planned_at: 2026-04-23T05:57:00+09:00
replanned_at: 2026-04-23T06:35:00+09:00
planned_against_commit: 7609401e9dc6eca716ca6fc3ea313e03eea0a357
depends_on:
  - TASK-2026-04-23-0555-program-card-redesign-with-relevance
  - TASK-2026-04-23-0556-address-field-and-region-matching
---

# Goal

현재 worktree에 이미 반영된 `/programs` 구조 개편을 기준으로 잔여 gap만 검증하고 보완합니다.

이 task는 최초 계획처럼 목록 페이지를 처음부터 재구현하는 작업이 아닙니다. Task 1
`TASK-2026-04-23-0555-program-card-redesign-with-relevance` 수행 중 `/programs` 영역이 크게 변경되어,
현재 구현을 보존하면서 누락된 동작, 타입 오류, URL query 동작, 섹션 간 책임 분리만 정리합니다.

# Dependencies

- 선행 의존성 1: Task 1 `TASK-2026-04-23-0555-program-card-redesign-with-relevance`
  - 현재 `tasks/done`에 있으며, 카드 컴포넌트와 추천 섹션 구조의 실제 기준입니다.
  - Task 1 후속 결정으로 `recommended` 정렬은 이번 scope에서 제외되었습니다.
- 선행 의존성 2: Task 2 `TASK-2026-04-23-0556-address-field-and-region-matching`
  - 현재 실행 중일 수 있습니다.
  - Task 2가 `backend/routers/programs.py`, `frontend/lib/types/index.ts`, `frontend/lib/api/backend.ts`,
    `/programs` UI를 변경했다면 이 task 시작 시 반드시 최신 worktree를 다시 비교해야 합니다.
- 실행 순서: Task 1 -> Task 2 -> Task 3 순서로 처리합니다.
- drift 정책: Task 2 완료 후 같은 파일의 의미 있는 변경이 추가되어 이 packet의 가정이 깨지면
  구현하지 말고 `reports/TASK-2026-04-23-0557-programs-listing-page-restructure-drift.md`를 갱신합니다.

# Current Baseline

현재 worktree에는 이미 다음 구현이 존재하는 것으로 확인되었습니다.

- `/programs` 페이지가 추천, 마감 임박, 전체 프로그램 영역을 분리해서 렌더링합니다.
- `ProgramCard`가 별도 파일로 분리되어 있습니다.
- `RecommendedProgramsSection`이 로그인/비로그인 상태를 고려합니다.
- `ProgramSort`는 `"deadline" | "latest"`만 허용합니다.
- 백엔드 프로그램 목록 API는 `deadline`, `latest` 정렬과 추가 필터를 지원합니다.
- 운영 기관, 추천 대상, 선발 절차, 채용 연계 계열 필터 파라미터가 일부 연결되어 있습니다.

따라서 이 task는 위 구현을 삭제하거나 재작성하지 말고, 실제 동작이 acceptance를 만족하는지 확인한 뒤
작은 보완만 적용합니다.

# Execution Scope

우선 확인할 파일:

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/backend.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

# Required Behavior

## Section Structure

- `/programs`는 아래 세 흐름을 유지합니다.
  - 맞춤 추천
  - 마감 임박
  - 전체 프로그램
- 전체 프로그램의 검색, 필터, 정렬, 페이지네이션 동작은 기존 동작을 유지합니다.
- 맞춤 추천 섹션은 전체 프로그램 페이지네이션에 영향받지 않습니다.
- 마감 임박 섹션은 전체 프로그램의 현재 페이지 결과에서 파생하지 않습니다.
- 마감 임박 섹션은 별도 fetch 또는 동등한 독립 데이터 흐름을 사용해야 합니다.
- 현재 구현처럼 deadline 정렬 fetch 후 프론트에서 D-7을 필터링하는 방식은 허용합니다.
  다만 과도한 overfetch, 잘못된 날짜 필드 사용, 전체 페이지네이션 의존이 있으면 보완합니다.

## Sorting

- 이번 scope의 정렬 query 값은 아래로 제한합니다.
  - `deadline`: 마감 임박순
  - `latest`: 최신순
- `recommended`와 `popular` 정렬은 이번 task의 non-goal입니다.
- URL에 `sort=recommended`, `sort=popular` 같은 과거 값이 들어오면 `deadline`으로 안전하게 fallback합니다.
- 로그인 유저 기본 정렬을 `recommended`로 바꾸지 않습니다.

## Filters

- 기존 필터와 모집 중만 보기 토글을 유지합니다.
- 이미 연결된 신규 필터는 URL query와 백엔드 query에 일관되게 반영되어야 합니다.
- 데이터가 부족한 필터는 무리하게 노출하지 말고 follow-up 또는 비노출 사유로 남깁니다.
- 필터 변경 시 페이지 번호는 1로 리셋합니다.

## Anonymous Recommendation CTA

- 비로그인 유저에게 개인화 추천 데이터를 노출하지 않습니다.
- 비로그인 추천 CTA는 현재 `/programs` 경로와 query string을 `redirectedFrom`으로 보존합니다.
- 블러/placeholder 카드는 실제 개인화 데이터가 아니어야 합니다.

## Required Field Filtering

- 제목, 모집 마감일, 출처 중 하나라도 누락된 프로그램은 노출하지 않는 기존 정책을 유지합니다.
- 모집 마감일은 `deadline` 또는 `close_date` 기준입니다.
- `end_date` 단독 값은 모집 마감일로 간주하지 않습니다.
- `provider`는 `source`의 표시 보조값일 수 있지만, 출처 필수값 자체를 대체하지 않습니다.

# Acceptance Criteria

1. 기존 `/programs` 검색, 필터, 모집 중 토글, 정렬, 페이지네이션이 유지됩니다.
2. `/programs`가 맞춤 추천, 마감 임박, 전체 프로그램 흐름으로 분리되어 있습니다.
3. 맞춤 추천 섹션은 비로그인 상태에서 CTA와 비개인화 placeholder를 노출합니다.
4. 로그인 추천 섹션은 Task 1에서 확정된 카드/추천 응답 필드와 충돌하지 않습니다.
5. 마감 임박 섹션은 D-7 이내 모집중 프로그램만 표시하거나, 데이터가 없으면 섹션을 숨깁니다.
6. 마감 임박 섹션은 전체 프로그램의 현재 페이지 결과에 의존하지 않습니다.
7. 정렬 옵션은 `deadline`, `latest`만 노출합니다.
8. `recommended` 또는 `popular` sort query는 `deadline`으로 fallback합니다.
9. 신규 필터 query가 UI, `frontend/lib/api/backend.ts`, `backend/routers/programs.py` 사이에서 일관됩니다.
10. 필터 변경 시 결과 카운트와 페이지 리셋이 현재 구조에서 정상 동작합니다.
11. 제목, 모집 마감일, 출처 필수 필드 정책이 모든 섹션에서 유지됩니다.
12. TypeScript, lint, backend router 관련 검증이 통과하거나, 환경 문제는 명확히 보고됩니다.

# Constraints

- 이미 구현된 `/programs` 구조를 전면 재작성하지 않습니다.
- Task 1에서 제외한 `recommended` 정렬을 되살리지 않습니다.
- `popular` 정렬은 북마크 집계 계약이 별도 확정되기 전까지 추가하지 않습니다.
- Task 2가 같은 파일을 변경했으면 그 결과를 존중하고, 덮어쓰지 않습니다.
- URL query 기반 상태 공유와 뒤로 가기 동작을 유지합니다.
- 대규모 라우트 재작성보다 현재 파일 구조 내 점진적 개선을 우선합니다.

# Verification Targets

- `frontend`: `npx tsc --noEmit --project tsconfig.json`
- `frontend`: `npm run lint`
- `frontend`: `/programs` sort query fallback, filter query, pagination reset
- `backend`: `backend/tests/test_programs_router.py` 중 프로그램 목록 필터/정렬/count 관련 테스트
- `backend`: Python 환경 문제로 pytest가 불가하면 원인과 대체 확인을 result report에 기록
- `git diff --check` on touched files

# Non-goals

- 카드 디자인의 추가 redesign
- 관련도 점수 계산 로직 구현
- `recommended` 정렬 구현
- `popular` 정렬 구현
- 주소 필드와 지역 매칭 구현
- collector/normalizer 대규모 개편
- 비교 페이지 UX 재설계

# Required Report

완료 후 `reports/TASK-2026-04-23-0557-programs-listing-page-restructure-result.md`에 아래를 기록합니다.

- changed files
- why changes were made
- preserved behaviors
- drift from original packet and why it was accepted or avoided
- risks / possible regressions
- follow-up refactoring candidates
- verification results
