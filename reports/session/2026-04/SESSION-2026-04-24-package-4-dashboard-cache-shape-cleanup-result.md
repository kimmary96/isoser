# SESSION-2026-04-24 package-4-dashboard-cache-shape-cleanup result

## Changed files
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.ts`
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.test.ts`
- `frontend/app/dashboard/_hooks/use-dashboard-recommendations.ts`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/refactoring-log.md`

## Why changes were made
- 패키지 4의 남은 frontend cleanup 중 하나로, 대시보드 추천 캘린더 로컬 캐시가 여전히 예전 `programs[]` flat shape를 같이 읽고 있던 경계를 줄였다.
- 새 캐시 정본은 `ProgramCardItem[]`로 고정하고, 이미 브라우저에 저장된 예전 캐시는 읽는 순간 자동으로 새 구조로 승격하게 해 기존 사용자 동작을 유지했다.

## Preserved behaviors
- 추천 캘린더 로컬 캐시 TTL 15분은 그대로 유지된다.
- 캐시가 없거나 만료된 경우 서버 재호출로 복구하는 기존 흐름은 유지된다.
- 기존 브라우저에 남아 있는 `programs[]` 캐시도 한 번은 정상적으로 읽힌다.

## Risks / possible regressions
- localStorage에 예상보다 더 깨진 구조가 들어 있으면 helper가 캐시를 비우고 서버 재호출로 넘어간다.
- `ProgramCardItem` 어댑터 내부의 legacy fallback 필드는 아직 남아 있어, 패키지 4 cleanup이 완전히 끝난 것은 아니다.

## Follow-up refactoring candidates
- `frontend/lib/program-card-items.ts`의 `_reason`, `_fit_keywords`, `_score`, `_relevance_score` fallback 축소
- 대시보드 추천/캘린더 카드 consumer에서 남아 있는 transition-only legacy 표시값 정리
