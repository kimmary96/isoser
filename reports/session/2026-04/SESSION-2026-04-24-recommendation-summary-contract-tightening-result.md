# SESSION-2026-04-24 Recommendation Summary Contract Tightening Result

## Changed files
- `frontend/lib/types/index.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.ts`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 프런트 타입 정의는 여전히 추천 응답의 `program`을 full `Program`으로 잡고 있었지만, 실제 backend recommendation/calendar payload는 `ProgramListItem` 기반 summary 계약을 쓰고 있었다.
- 이 차이 때문에 코드가 필요 이상으로 detail/legacy 필드까지 가진다고 착각할 여지가 있었고, cleanup backlog의 `Program monolith 축소` 측면에서도 과한 타입 폭을 줄일 필요가 있었다.
- 같은 맥락으로 `/programs` helper와 compare selection helper도 broad `ProgramCardRenderable`보다 더 좁은 summary/list 계약으로 충분했고, 마지막으로 central adapter와 legacy browser cache migration까지 summary 기준으로 보정해 전이 별칭 자체를 제거할 수 있었다.

## Preserved behaviors
- dashboard recommendation/calendar BFF의 최종 응답은 계속 `items: ProgramCardItem[]`다.
- 추천 사유, 관련도, urgency, deadline override, fallback 동작은 바뀌지 않았다.
- 변경은 추천 upstream payload를 프런트에서 더 정확한 summary 타입으로 읽도록 맞춘 것이다.
- `/programs` page helper 동작도 그대로 유지되고, 변경은 현재 페이지가 실제로 쓰는 타입 범위를 더 정확히 적은 수준이다.
- old browser `programs[]` cache는 그대로 버리지 않고, summary normalizer를 거쳐 `items[]` 캐시로 자동 승격하는 호환 동작을 유지했다.

## Risks / possible regressions
- 이후 프런트가 recommendation/calendar upstream `program`에서 detail 전용 필드를 새로 읽으려 하면 타입 수준에서 바로 막히게 된다. 현재 코드 기준으로는 오히려 의도된 보호장치다.
- backend가 장차 recommendation payload에 summary를 넘어서 detail 필드를 실어도, 프런트는 그 추가 필드를 자동으로 사용하지 않는다. 필요 시 그때 명시적으로 타입을 다시 넓혀야 한다.
- legacy browser cache에 summary 핵심 필드가 심하게 부족한 아주 오래된 JSON이 남아 있으면, 이번 normalizer는 해당 row를 버리고 캐시를 비울 수 있다. 현재 동작 기준으로는 안전한 정리 쪽에 가깝다.

## Test points
- `frontend`: `npx tsc --noEmit`
- `frontend`: `npm test -- lib/program-card-items.test.ts lib/program-display.test.ts`
- `frontend`: `npm test -- app/dashboard/_hooks/recommend-calendar-cache.test.ts`

## Follow-up refactoring candidates
- backend `ProgramListItem`와 frontend `ProgramCardSummary`가 아직 완전히 1:1 이름/구조로 정렬된 것은 아니므로, recommendation/list/batch 공통 summary 계약 이름을 장기적으로 맞추는 작업 검토
- `ProgramCardRenderable = ProgramCardSummary | Program` 전이 별칭이 아직 필요한 범위를 landing preview/cache 경로 기준으로 다시 줄일 수 있는지 재검토
