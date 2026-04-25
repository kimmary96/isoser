# SESSION-2026-04-26-landing-chip-qa-fix-result

## changed files
- `frontend/lib/program-filters.ts`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/lib/server/public-programs-fallback.ts`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/lib/program-filters.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- 랜딩 `창업` 칩이 `category=창업` 결과만 믿어 `K-Startup` 계열 공고를 놓치면서 빈 상태로 떨어질 수 있었다.
- 랜딩 카테고리 칩은 browse pool/read-model 결과가 부족해도 최소 6개 카드를 보여줘야 했는데, 기존에는 `무료` 외에는 부족분을 보충하는 경로가 없었다.
- 후속 QA에서 `온라인` 칩이 `regions=온라인`처럼 잘못 전달되어 고용24 `teaching_method=온라인` 다수를 놓칠 가능성이 확인됐다.
- Work24 계열 비용 노출은 총 훈련비와 본인부담금이 섞여 있었고, 카드/목록에서는 본인부담금 우선 표기가 더 맞는 요구가 확인됐다.

## preserved behaviors
- `창업` 칩의 backend 요청은 계속 `category=창업`을 사용한다.
- `전체`/`무료`/지역 칩의 기존 query param 계약은 유지한다.
- Opportunity feed의 최종 카드 정렬은 기존 `orderOpportunityPrograms(...)` 규칙을 그대로 사용한다.
- 본인부담금 값이 없는 소스는 기존 총 훈련비/지원 텍스트 fallback을 유지한다.

## risks / possible regressions
- `창업` 칩의 local matcher가 `창업`, `예비창업`, `스타트업` 텍스트를 추가로 보기 때문에, 일부 비-K-Startup 창업성 프로그램도 함께 잡힐 수 있다.
- 보충 fallback은 legacy `programs` row를 더 넓게 스캔하므로, Supabase 응답이 매우 느린 로컬 세션에서는 첫 렌더 후속 보충이 약간 느려질 수 있다.
- Work24 `subsidy_amount/realMan` 해석은 현재 고용24 UI와 상세 파서 흐름을 근거로 `본인부담금` 쪽으로 맞췄다. 만약 원천 정의가 다른 소스 row가 섞여 있으면 일부 금액 표기가 기대와 다를 수 있다.

## tests
- `frontend`: `npm test -- lib/program-filters.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`
- `frontend`: `npx tsc --noEmit --pretty false`
- `frontend`: `npm test -- lib/program-filters.test.ts lib/program-display.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`

## follow-up refactoring candidates
- 랜딩 칩별 fallback 보충 규칙을 `landing-a`와도 공유할지 결정하고, 필요하면 `landing-c` 전용 로직을 공용 helper로 분리
- `loadPublicFilteredProgramFallbackRows(...)`의 scan 범위와 정렬 기준을 칩 종류별로 더 세밀하게 나눌지 검토
