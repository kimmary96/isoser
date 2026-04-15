# Result Report

## Task
- id: `TASK-2026-04-15-1040-programs-hub-delta`
- title: `프로그램 허브 델타 정렬 — 기존 /programs UX 고도화 + query/filter 정합성 보강`

## Changed files
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/programs/page.tsx`
- `frontend/lib/api/backend.ts`
- `frontend/lib/program-categories.ts`
- `frontend/lib/types/index.ts`
- `docs/specs/api-contract.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `tasks/inbox/TASK-2026-04-15-1040-programs-hub-delta.md`

## Why changes were made
- 기존 `/programs`는 카테고리 단일 필터 수준이라 검색, 지역 필터, 모집중 토글, 정렬, 페이지네이션 요구를 충족하지 못했다.
- 기존 `GET /programs/` 응답 shape를 바꾸지 않고 목록 총건수를 제공해야 해서 `/programs/count`를 별도 추가했다.
- 프론트 카테고리 상수가 실제 backend/programs category 체계와 맞지 않아 빈 결과를 유도할 수 있었기 때문에 정렬이 필요했다.

## What changed
- backend `GET /programs/`에 `q`, `regions`, `recruiting_only`, `sort` query를 추가했다.
- backend에 `/programs/count`를 추가해 필터된 총건수를 반환하도록 했다.
- frontend `/programs`를 URL query 기반 서버 렌더링 페이지로 확장하고 검색, 카테고리/지역 필터, 모집중 토글, 정렬, 활성 필터 칩, 20건 페이지네이션을 넣었다.
- category 상수를 `AI`, `IT`, `디자인`, `경영`, `창업`, `기타` 중심으로 정리했다.
- 관련 API 계약과 현재 상태 문서를 갱신했다.

## Preserved behaviors
- `/programs`는 계속 비로그인 접근 가능하다.
- `frontend/middleware.ts` 보호 범위는 변경하지 않았다.
- `/programs/{id}` 상세 페이지 route와 링크 흐름은 유지했다.
- 기존 `GET /programs/`의 row array 응답 shape는 유지했다.
- 관리자 sync의 `hrd_id` 기반 upsert 흐름은 건드리지 않았다.
- 기존 migration 파일은 수정하지 않았고 새 migration도 추가하지 않았다.

## Checks
- `npm exec tsc -- --noEmit` in `frontend`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py`

## Risks / possible regressions
- 지역 필터는 현재 `location` substring 기반이라 데이터 표기 편차가 크면 일부 프로그램이 기대한 지역 그룹에 정확히 매핑되지 않을 수 있다.
- `latest` 정렬은 `created_at` 기준으로 동작하므로 실제 운영에서 `updated_at`이 더 적합하면 이후 조정이 필요하다.
- 페이지 번호가 총 페이지보다 큰 query로 직접 들어오면 현재는 빈 결과로 보일 수 있다. UX 차원에서 자동 보정 redirect가 필요할 수 있다.
- category 상수 축소는 `/`와 `/landing-a`의 진입용 카테고리 칩에도 반영되므로, 더 세분화된 탐색이 필요하면 별도 매핑 레이어가 필요하다.

## Follow-up refactoring candidates
- programs query normalization과 region alias 규칙을 별도 모듈로 추출해 frontend/backend 중복 규칙을 줄이기
- `/programs` 목록용 DTO와 count endpoint를 BFF 계층으로 감싸서 backend/raw row 의존도를 낮추기
- page 범위 초과 query 자동 보정 및 region facet count 제공
- category label과 backend value를 명시적 매핑 객체로 분리해 랜딩과 목록의 관심사 분리

## Git Automation
- not run
