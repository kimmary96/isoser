# SESSION-2026-04-24-dashboard-bookmarks-calendar-structure-result

## changed files
- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/app/api/dashboard/calendar-selections/route.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- 추천/캘린더 주 경로만 `ProgramCardItem` 구조를 쓰고 `bookmarks`, `calendar-selections`가 아직 legacy `Program[]` 또는 nullable program wrapper를 유지하고 있어 dashboard 전체 구조가 반쪽 상태였다.
- dashboard 전반의 응답/소비 패턴을 빠르게 하나로 맞추기 위해, 보조 BFF 경로도 `program + context` 구조로 전환했다.

## preserved behaviors
- 찜 목록의 순서와 캘린더 적용 프로그램 최대 3개 제한은 유지했다.
- `saveCalendarSelections()` PUT 계약과 서버 저장 방식은 유지했다.
- 비교 모달은 여전히 `찜한 프로그램`과 `전체 검색` 두 탭을 그대로 제공한다.

## risks / possible regressions
- `/api/dashboard/bookmarks`와 `/api/dashboard/calendar-selections`의 응답 shape가 바뀌었기 때문에, 아직 구형 shape를 기대하는 호출자가 있으면 깨질 수 있다.
- `bookmarks` 응답에서 null program placeholder를 제거했기 때문에, 예전처럼 metadata row 수와 응답 item 수가 정확히 같다고 가정하는 코드는 맞지 않을 수 있다.
- `calendar-selections`는 이제 `selected_at`을 context로만 들고 가므로, 구형 `{ programs }` 응답을 그대로 재사용하던 곳은 수정이 필요하다.

## verification
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`
- `git diff --check`
  - `docs/current-state.md`의 기존 trailing whitespace 때문에 전체 clean pass는 아님
  - 이번 변경으로 새 TypeScript 오류는 추가되지 않음

## follow-up refactoring candidates
- `frontend/app/dashboard/page.tsx`에서 찜 섹션/추천 섹션/적용 일정 상태 관리를 별도 hook으로 분리
- bookmark/selection/recommendation BFF route의 `ProgramCardSummary` 캐스팅과 context 조립을 공용 adapter 유틸로 추출
- `frontend/lib/types/index.ts`의 legacy `RecommendedProgram`, `RecommendedProgramsResponse`, `ProgramCalendarRecommendItem` 제거 준비
