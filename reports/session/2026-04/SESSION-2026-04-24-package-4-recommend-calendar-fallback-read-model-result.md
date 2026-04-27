# SESSION-2026-04-24-package-4-recommend-calendar-fallback-read-model-result

## changed files
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## why changes were made
- 패키지 4의 남은 read switch 중 하나로, 추천 캘린더의 마지막 direct Supabase fallback이 아직 `programs`를 바로 읽고 있어 read-model 전환이 덜 끝난 상태였다.
- 같은 카드 요약 규칙을 계속 쓰기 위해 `program_list_index` 우선 + `programs` 최후 fallback helper를 공용화했다.

## preserved behaviors
- 추천 캘린더의 fallback reason 문구와 `DashboardRecommendCalendarResponse` 응답 shape는 유지된다.
- `program_list_index`가 없는 환경에서는 기존처럼 `programs` fallback이 동작한다.
- Work24 deadline 신뢰도 보호 로직은 유지되며, read-model row에서는 `deadline_confidence=low`를 제외 기준으로 사용한다.

## risks / possible regressions
- read-model row에 deadline confidence가 비어 있는 환경에서는 일부 fallback 카드가 기존과 다르게 남을 수 있다.
- direct Supabase fallback이 `ProgramCardSummary`와 `Program`을 함께 다루게 되면서, 이후 consumer가 monolith `Program`만 가정하면 타입 drift가 다시 생길 수 있다.

## tests
- `npm run test -- lib/server/program-card-summary.test.ts lib/server/recommendation-profile.test.ts`
- `npx tsc -p tsconfig.codex-check.json --noEmit`

## follow-up refactoring candidates
- `dashboard/recommended-programs`와 `dashboard/recommend-calendar` BFF의 transition-only legacy field 의존 더 줄이기
- compare/detail 경로도 같은 read-model-first helper 축으로 정리하기
