# SESSION-2026-04-24 program-list-contract-bff-datekey result

## changed files
- `frontend/app/api/programs/compare-search/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/types/index.ts`
- `frontend/lib/program-display.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/page-helpers.ts`
- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-a/_hero.tsx`
- `frontend/app/(landing)/landing-a/_program-feed.tsx`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_hero.tsx`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/components/landing/program-card-helpers.ts`
- `frontend/components/MiniCalendar.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-mini-calendar.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-recommendations.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- compare 검색 탭은 실제로 선택 카드에 필요한 몇 개 필드만 쓰는데도 브라우저가 무거운 `/programs` 응답 전체를 직접 받고 있어, 같은 검색 동작을 유지한 채 전용 BFF로 payload를 줄일 필요가 있었다.
- `/programs/list`는 이미 문서상 정본이 `ProgramListRow`인데도 실제 응답은 여전히 flat `Program` 중심이라, 목록 축 B 계약을 실제 코드에 한 단계 더 맞출 필요가 있었다.
- MiniCalendar와 dashboard calendar가 날짜 key와 같은 날짜 비교를 각각 따로 구현하고 있어, 화면마다 날짜 해석이 미세하게 엇갈릴 위험을 줄일 공용 helper 정리가 필요했다.

## preserved behaviors
- compare 모달의 검색/북마크 탭 전환, 300ms 검색 지연, `deadline` 정렬, 모집중 20건 검색, 선택 추가 흐름은 그대로 유지된다.
- `/programs`와 `/programs/popular`의 공개 flat row 응답 shape는 유지된다.
- `/programs`, `landing-a`, `landing-c` 화면은 기존과 같은 카드/목록 표시 흐름을 유지하고, 목록 페이지는 새 wrapper 응답을 페이지 경계에서만 풀어 사용한다.
- dashboard mini calendar와 일반 mini calendar의 선택 날짜, 오늘 강조, 월 단위 마감 표시 동작은 유지된다.

## risks / possible regressions
- `/programs/list`를 직접 소비하는 다른 경로가 새 `program + context` wrapper를 아직 기대하지 않으면 누락된 소비처에서 runtime 문제가 생길 수 있다.
- compare 검색 BFF는 현재 backend summary 전용 endpoint가 아니라 server-side downcast라서, 브라우저 payload는 줄었지만 server-to-backend payload 최적화는 아직 남아 있다.
- 날짜 helper 통합 후 브라우저 timezone 차이로 기존과 아주 미세한 표시 차이가 생길 가능성은 있다.

## verification
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`
- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_programs_router.py -q`
- `git diff --check`
  - hard error는 없었고, 기존/현재 파일들의 CRLF warning만 출력됨

## follow-up refactoring candidates
- compare 검색도 backend 쪽 summary endpoint 또는 `/programs/list` 기반 summary path로 옮겨 server-to-backend payload까지 줄이기
- `/programs/list`를 소비하는 나머지 경로에서도 `Program` 대신 `ProgramListRow` 기반 narrow type을 더 넓게 적용하기
- `ProgramListRowItem`용 frontend adapter/helper를 별도 유틸로 분리해 페이지 경계의 unwrap 패턴을 더 명확히 표준화하기
