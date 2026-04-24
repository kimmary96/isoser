# SESSION-2026-04-24 package-4 compare summary type shrink result

## 변경 파일
- `frontend/lib/types/index.ts`
- `frontend/lib/api/backend.ts`
- `frontend/app/(landing)/compare/compare-table-sections.tsx`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 패키지 4의 compare/detail consumer cleanup에서 compare 상단 카드가 전체 `Program` monolith를 들고 있을 이유가 거의 없어졌기 때문이다.
- 이미 backend `/programs/batch`가 compare top-card용 summary 성격으로 좁아지고 있어서, frontend도 그 경계를 같이 줄이는 편이 안전하다.

## 실제 변경
- `ProgramBatchResponse.items`를 `ProgramCardSummary[]`로 정리했다.
- `frontend/lib/api/backend.ts::getPrograms()`도 이제 `ProgramCardSummary[]`를 반환한다.
- compare 화면의 `CompareProgram`은 `ProgramCardSummary + ProgramDetail` 조합으로 바꿨다.

## 유지한 동작
- compare 화면의 URL state, 슬롯 3개 비교, 관련도 계산, 상세 batch 보강 흐름은 그대로다.
- summary card는 여전히 `days_left`, 링크, 기관명, 지역, 태그, 설명 요약을 표시한다.
- 상세 비교 표는 계속 `ProgramDetail` batch 결과를 additive로 붙여 렌더링한다.

## 리스크 / 가능한 회귀
- compare consumer가 과거 full `Program` 전용 필드를 새로 참조하게 되면 타입 단계에서 바로 막히도록 바뀌었다.
- `/programs/batch`가 앞으로 summary 범위를 더 줄일 경우 compare UI와의 계약을 같이 맞춰야 한다.

## 검증
- `frontend\npm run test -- app/api/dashboard/recommend-calendar/route.test.ts lib/server/program-card-summary.test.ts lib/server/recommendation-profile.test.ts`
- `frontend\npx tsc -p tsconfig.codex-check.json --noEmit`

## 추가 리팩토링 후보
- compare page server loader를 compare 전용 helper로 더 분리
- `getProgram()` legacy monolith helper 축소
- compare 표에서 detail-only 필드와 summary-only 필드 경계 명확화
