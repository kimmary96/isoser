# SESSION-2026-04-24-dashboard-program-card-item-bff-result

## changed files
- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-calendar.ts`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-mini-calendar.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- 추천/캘린더 BFF가 아직 legacy flattened `Program` 응답을 유지하고 있어 `ProgramSurfaceContext` 전환 효과가 실제 소비 코드까지 이어지지 못하고 있었다.
- 구조 효과를 빠르게 크게 내기 위해, dashboard 추천/캘린더 경로를 `items: ProgramCardItem[]`로 직접 전환하고 landing/dashboard 소비 코드도 `program + context`를 바로 읽도록 정리했다.

## preserved behaviors
- 비로그인 landing 추천 프리뷰 카드는 계속 legacy `Program`만으로 렌더링된다.
- 추천 카드의 제목, 출처, 마감일, 관련도, 추천 이유, 북마크 버튼 동선은 유지한다.
- dashboard 메인 캘린더의 선택/적용/초기화 흐름과 `calendar-selections` 저장 API 사용 방식은 유지한다.
- `getCalendarSelections()`와 `getDashboardBookmarks()`처럼 아직 legacy `Program`을 돌려주는 경로는 그대로 둬 과도한 동시 변경을 피했다.

## risks / possible regressions
- `/api/dashboard/recommended-programs`와 `/api/dashboard/recommend-calendar`의 응답 shape가 바뀌었기 때문에, 아직 새 구조를 모르는 호출자는 깨질 수 있다.
- localStorage에 남아 있던 구형 추천 캐시가 새 구조와 섞일 수 있어, 브라우저마다 첫 진입 시 한 번 정도 이전 캐시 fallback이 섞일 가능성이 있다.
- dashboard/calendar 보조 컴포넌트가 이제 `context` 우선으로 점수를 읽으므로, context가 빠진 임시 데이터에서는 배지/점수 표시가 일부 달라질 수 있다.

## verification
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`
- `git diff --check`
  - hard error 없음
  - CRLF warning만 확인

## follow-up refactoring candidates
- `dashboard/bookmarks`와 `calendar-selections`도 `ProgramCardItem`/`ProgramSurfaceContext` 기준으로 맞춰 recommendation surface contract를 dashboard 전반으로 확장
- `frontend/app/dashboard/page.tsx`에서 여전히 큰 로컬 카드/캐시 로직을 별도 hook + presentational component로 분리
- landing/programs 일반 목록 카드와 dashboard 카드 사이의 score/reason 표시 헬퍼를 공용 adapter로 추출
