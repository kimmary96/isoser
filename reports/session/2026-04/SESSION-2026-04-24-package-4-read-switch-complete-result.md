# SESSION-2026-04-24 package-4-read-switch-complete result

## Changed files
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/lib/programs-page-layout.ts`
- `frontend/lib/program-display.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/lib/program-card-items.test.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-calendar.ts`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## Why changes were made
- 저장소 코드 기준 package-4의 남은 read switch를 닫기 위해, 아직 flat `/programs`에 기대던 landing `/programs`의 `Closing Soon` strip을 `listProgramsPage(...)` 기반 read-model-first 경로로 옮겼다.
- dashboard recommendation strip, dashboard calendar hook/card, recommend-calendar fallback이 모두 같은 `ProgramCardItem` / shared helper 우선순위를 따르도록 맞춰 화면별 drift를 줄였다.
- roadmap와 entrypoint 문서 일부가 실제 코드보다 뒤처져 있어 현재 저장소 상태에 맞게 보정했다.

## Preserved behaviors
- `Closing Soon` strip의 공개 화면 동작과 카드 구성은 유지된다.
- read-model 요청이 실패하면 기존 `listPrograms(...)` fallback 경로로 계속 복구된다.
- dashboard recommendation/calendar 카드의 공개 입력 타입과 화면 흐름은 유지된다.

## Risks / possible regressions
- 추정: read-model 경로에서 urgent strip이 이전보다 더 요약형 row를 우선 쓰므로, 아주 일부 legacy-only 세부 필드가 있었다면 fallback이 아닌 주 경로에서는 덜 보일 수 있다.
- 다만 현재 urgent strip이 실제로 쓰는 필드는 `ProgramListRow`로 충분한 범위로 확인했다.

## Follow-up refactoring candidates
- `frontend/lib/api/backend.ts::listPrograms()`와 `getProgram()`의 실제 사용처 재점검 후 cleanup 여부 판단
- `frontend/lib/types/index.ts::Program`의 `_reason/_fit_keywords/_score/_relevance_score` 제거 시점 확정
- 운영 DB migration apply / backfill / row count / sample validation 실행 및 결과 문서화
