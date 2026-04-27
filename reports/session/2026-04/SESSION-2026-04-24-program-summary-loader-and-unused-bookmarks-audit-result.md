# SESSION-2026-04-24 Program Summary Loader And Unused Bookmarks Audit

## changed files
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/app/api/dashboard/calendar-selections/route.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/server/recommendation-profile.ts`
- `frontend/lib/server/recommendation-profile.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- bookmark/calendar-selection 같은 보조 BFF는 상세용 legacy `Program` 전체가 필요 없어서, id 조회 helper도 `ProgramCardSummary` 기준으로 줄였다.
- compare 선택 카드 요약은 실제로 `compare_meta`를 쓰지 않았기 때문에, 불필요한 메타를 들고 다니지 않도록 `ProgramSelectSummary`를 더 작게 만들었다.
- `recommendation-profile.ts`에는 이미 공용 normalizer로 대체된 legacy export가 남아 있어, 현재 코드 기준으로 안 쓰는 helper를 정리했다.
- DB 후보 검증에서는 실제 런타임 bookmark 정본이 무엇인지 다시 확인할 필요가 있었고, 저장소 코드 기준으로는 `program_bookmarks`만 active 경로였다.

## preserved behaviors
- bookmark/calendar-selection 응답 shape는 그대로 `items: ProgramCardItem[]`를 유지한다.
- read model에 row가 없을 때 `programs` fallback을 쓰는 동작 자체는 유지한다.
- compare 검색/찜 탭 카드 UI와 프로그램 추가 흐름은 그대로 유지된다.
- recommendation profile refresh와 cache invalidation 동작은 그대로 유지된다.

## risks / possible regressions
- legacy `programs` row를 summary로 줄이는 과정에서, bookmark/calendar-selection이 미래에 상세 전용 필드를 새로 기대하게 되면 값이 비어 보일 수 있다.
- `ProgramSelectSummary`에서 `compare_meta`를 제거했기 때문에, compare 선택 카드가 나중에 해당 메타를 다시 쓰게 되면 타입 단계에서 먼저 막히게 된다.
- `public.bookmarks`는 저장소 코드 기준 unused 후보지만, 외부 수동 운영 쿼리나 외부 스크립트까지 완전히 배제한 것은 아니다. 따라서 삭제 전에는 운영 확인이 한 번 더 필요하다.

## unused db/field audit
- 저장소 코드 기준 runtime bookmark 경로는 `program_bookmarks`다.
  - 근거: `backend/routers/bookmarks.py`의 REST 경로가 모두 `/rest/v1/program_bookmarks`를 사용한다.
  - 근거: `frontend/app/api/dashboard/bookmarks/route.ts`, `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/[id]/page.tsx`도 `program_bookmarks`를 읽는다.
- 반대로 `public.bookmarks` 직접 read/write 흔적은 저장소 코드 검색에서 찾지 못했다.
  - 남아 있는 위치는 `supabase/SQL.md`의 `Table bookmarks` 문서와 `supabase/migrations/20260415_create_recommendations.sql`의 legacy table 정의다.
- 그래서 `public.bookmarks`는 현재 저장소 기준으로 unused DB 후보로 추정한다.

## follow-up refactoring candidates
- `loadDeadlineOrderedProgramCardRenderables()`까지 summary-first로 더 줄일 수 있는지, Work24 deadline 신뢰도 판단과 함께 별도 검토
- `program-display.ts`에 남은 `compare_meta` fallback을 direct summary/detail 필드로 더 치환
- `ProgramCardRenderable = ProgramCardSummary | Program` 전이 별칭을 실제 caller 기준으로 더 축소
