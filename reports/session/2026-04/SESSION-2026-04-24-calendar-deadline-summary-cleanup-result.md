# SESSION-2026-04-24 Calendar Deadline Summary Cleanup Result

## Changed files
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/lib/server/recommend-calendar-fallback.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- `recommend-calendar` direct Supabase fallback가 아직 `ProgramCardRenderable`과 route-local `compare_meta` 판정에 기대고 있어, package-5 cleanup 관점에서 남은 monolith/legacy 의존이 있었다.
- `program_list_index` 미적용 환경에서도 동작은 유지해야 해서, 삭제보다 summary-only downcast와 공용 helper 추출이 가장 작은 안전한 정리 경로였다.

## Preserved behaviors
- `GET /api/dashboard/recommend-calendar`의 최종 응답 shape는 계속 `items: ProgramCardItem[]`다.
- personalized recommendation -> backend `/programs/list` fallback -> direct Supabase fallback 순서는 그대로 유지했다.
- Work24에서 `deadline=end_date` 오염 row를 제외하는 규칙은 유지했고, `compare_meta.deadline_source=traStartDate` 또는 명시적 마감 evidence가 있는 경우만 예외로 허용하는 동작도 유지했다.

## Risks / possible regressions
- direct Supabase fallback이 legacy `programs` row를 `ProgramCardSummary`로 축소하므로, 이 경로에서 summary에 없는 detail 전용 필드를 새로 기대하면 앞으로는 보이지 않는다. 현재 route/card helper는 그 필드를 쓰지 않으므로 의도된 제한이다.
- `hasTrustedProgramDeadline(...)`를 공용 helper로 옮긴 만큼, 이후 다른 화면이 같은 helper를 재사용할 때 캘린더용 Work24 규칙이 넓게 적용될 수 있다. 현재는 recommend-calendar fallback 용도로만 호출된다.

## Test points
- `frontend`: `npm test -- lib/program-display.test.ts lib/server/program-card-summary.test.ts lib/server/recommendation-profile.test.ts lib/normalizers/profile.test.ts lib/program-card-items.test.ts`
- `frontend`: `npx tsc --noEmit`

## Follow-up refactoring candidates
- `CalendarRecommendResponse`와 `ProgramRecommendResponse`의 upstream `program: Program` 계약을 바로 줄일 수 있는지 backend serializer/BFF 경계를 다시 점검
- `frontend/lib/types/index.ts`의 `ProgramCardRenderable = ProgramCardSummary | Program` 전이 별칭이 실제로 더 필요한지 재평가
- `public.bookmarks` 같은 unused DB 후보는 운영 스크립트 사용 여부까지 확인한 뒤에만 drop 후보로 승격
