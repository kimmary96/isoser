# SESSION-2026-04-24 Dead Landing Recommend Preview Cleanup Result

## Changed files
- `frontend/app/(landing)/programs/program-card.tsx` (deleted)
- `frontend/app/(landing)/programs/recommended-programs-section.tsx` (deleted)
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 두 파일은 저장소 검색 기준으로 실제 import가 없었고, dashboard recommendation BFF 전환 이후 현재 `/programs` 화면 경로에서도 더 이상 사용되지 않았다.
- 유지할 이유가 없는 preview/dead component를 남겨 두면 `ProgramCardRenderable` 과도기 흔적과 landing recommendation 구조를 실제보다 넓게 보이게 만든다.

## Preserved behaviors
- `/programs` 현재 런타임 화면은 그대로 유지된다.
- dashboard recommendation/calendar/bookmark 흐름에는 영향이 없다.
- 삭제한 파일들은 현재 코드 경로상 참조가 없던 dead code였다.

## Risks / possible regressions
- 외부 문서나 사람 기억만 믿고 해당 컴포넌트를 수동으로 다시 import하려 하면 삭제 사실을 알아야 한다.
- 동적 import나 문자열 기반 로더는 저장소 검색만으로 100% 증명하기 어렵다. 다만 현재 코드베이스 기준으로 그런 흔적은 찾지 못했다는 점에서 `추정이 아니라 저장소 검색 기준 미참조`로 판단했다.

## Test points
- `frontend`: `npx tsc --noEmit`
- 저장소 검색으로 `program-card.tsx`, `recommended-programs-section.tsx`의 코드 참조 0건 재확인

## Follow-up refactoring candidates
- `ProgramCardRenderable = ProgramCardSummary | Program` 별칭이 이제 landing preview 삭제 후에도 계속 필요한지 다시 점검
- `recommend-calendar-cache`의 legacy `programs[]` browser cache auto-migration 경로가 충분히 오래 유지됐는지 확인 후 축소 검토
