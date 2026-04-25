# SESSION-2026-04-26 Program Card Cost Schedule Dday Result

## Changed files
- `frontend/lib/types/index.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/app/dashboard/_hooks/recommend-calendar-cache.ts`
- `frontend/components/programs/program-deadline-badge.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `frontend/app/(landing)/programs/programs-table-helpers.ts`
- `frontend/app/(landing)/programs/programs-table.tsx`
- `frontend/app/(landing)/programs/programs-urgent-card.tsx`
- `frontend/app/dashboard/_components/dashboard-program-cards.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 일부 고용24 카드가 `본인부담금` 라벨 아래 총 훈련비를 계속 보여서, 공용 비용 해석을 `support_amount`와 legacy `compare_meta` camelCase 키까지 확장했다.
- non-Work24 카드가 신청기간을 운영 일정처럼 렌더링해 무료/창업 카드에서 의미가 어긋나던 문제를 줄이기 위해, source-aware 일정 helper를 추가했다.
- 랜딩/대시보드/마감임박 카드마다 D-day badge UI가 제각각이어서 공통 badge component로 통일했다.

## Preserved behaviors
- `고용24` 카드는 계속 훈련 기간(`start_date/end_date`)을 일정 라인에 사용한다.
- 기존 `days_left` 기반 마감 정렬과 open-only filtering 규칙은 바꾸지 않았다.
- `/programs` 표의 비용 컬럼은 여전히 `formatProgramCostLabel(...)` 공용 helper를 사용하되, 해석 우선순위만 보강했다.
- snapshot/read-model/fallback 데이터 로딩 경로는 변경하지 않고 display layer 위주로 조정했다.

## Risks / possible regressions
- non-Work24 source에서 실제 운영 일정 데이터가 없고 신청기간만 있는 경우, 이전처럼 날짜를 억지로 보여주지 않고 `일정 확인 필요`가 보일 수 있다.
- legacy `compare_meta.actualTrainingCost`를 본인부담금 후보로 해석한 부분은 데이터 의미가 source마다 다를 수 있어 추정이 포함된다.
- 브라우저 local cache에 예전 card payload가 남아 있으면 새 `compare_meta/support_amount` 보강 전 값이 잠깐 보일 수 있으므로 dev 환경에서는 새로고침 또는 cache 재생성이 필요할 수 있다.

## Tests
- `npm test -- lib/program-display.test.ts lib/server/program-card-summary.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`
- `npx tsc --noEmit --pretty false`

## Follow-up refactoring candidates
- live DB의 landing snapshot SQL도 `support_amount`와 source-aware schedule fields를 item payload에 명시적으로 넣어 frontend 추론 의존도를 더 줄일 수 있다.
- detail/compare/table/card가 각각 가진 날짜 라벨 문구(`훈련 기간`, `교육 기간`, `일정`)를 한 계약으로 더 정리할 수 있다.
- dashboard browser cache normalization을 `ProgramCardSummary` shared serializer로 묶어 로컬 cache migration 중복을 더 줄일 수 있다.
