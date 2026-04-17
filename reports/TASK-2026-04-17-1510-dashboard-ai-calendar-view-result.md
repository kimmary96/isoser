# TASK-2026-04-17-1510-dashboard-ai-calendar-view result

## Changed files
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-calendar.ts`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-mini-calendar.tsx`
- `docs/refactoring-log.md`

## Why changes were made
- 기존 `/dashboard` 홈은 `getRecommendedPrograms` 기반의 오래된 추천 프로그램 UI를 그대로 사용하고 있어, task가 요구한 `GET /api/dashboard/recommend-calendar` 기반 캘린더 섹션과 맞지 않았다.
- 캘린더 전용 데이터를 `frontend/app/dashboard/_hooks/use-dashboard-calendar.ts`로 분리해 BFF 호출, `final_score desc + deadline asc` 정렬, 5초 fallback, 에러 시 섹션 숨김 규칙을 한곳에 모았다.
- 대시보드 UI는 `dashboard-calendar-section`과 `dashboard-calendar-mini-calendar`로 분리해 가로 스크롤 카드, D-day 배지, 외부 지원 CTA, `/dashboard/resume?prefill_program_id=<id>` 링크, 미니 월간 캘린더를 현행 요구사항에 맞췄다.

## Preserved behaviors
- `/dashboard` 상단 인사말의 사용자 정보 로딩은 그대로 유지했다.
- 캘린더 API 에러는 다른 대시보드 영역을 깨뜨리지 않고 섹션만 숨기도록 유지했다.
- 브라우저에서 backend/Supabase를 직접 호출하지 않고 기존 Next BFF 경로만 사용했다.

## Risks / possible regressions
- 캘린더 카드 클릭은 `/programs/[id]`로 이동하므로, 해당 프로그램 상세 라우트가 특정 id 형식에서 엄격하면 일부 레거시 id 데이터는 상세 페이지에서 추가 검증이 필요할 수 있다.
- 추천 데이터가 8건을 초과하면 현재는 상위 8건만 노출한다. 더 많은 카드를 보여야 하면 pagination 또는 “더 보기”가 후속으로 필요하다.
- 기존 공용 `frontend/components/MiniCalendar.tsx`는 현재 대시보드에서 더 이상 사용하지 않는다. 이후 다른 화면에서 재사용 여부를 보고 정리할 수 있다.

## Follow-up refactoring candidates
- 카드/배지 포맷터(`source`, `D-day`, `score`)를 별도 dashboard calendar util로 분리하면 테스트와 재사용이 쉬워진다.
- `useDashboardCalendar`에 retry 또는 `force_refresh` 옵션을 추가하면 대시보드 새로고침 UX를 더 세밀하게 제어할 수 있다.
- 미니 캘린더 날짜 선택 상태를 URL 또는 analytics 이벤트로 연결하면 사용 패턴 측정이 가능하다.

## Verification
- `npm exec -- tsc --noEmit --pretty false --project tsconfig.json` 실행
- 결과: 실패
- 실패 원인: 현재 저장소의 pre-existing `.next/types/app/programs/[id]/page.ts` 모듈 해석 오류
  - `.next/types/app/programs/[id]/page.ts(2,24): Cannot find module '../../../../../app/programs/[id]/page.js'`
  - `.next/types/app/programs/[id]/page.ts(5,29): Cannot find module '../../../../../app/programs/[id]/page.js'`
- 이번 task에서 변경한 dashboard calendar 파일에 대한 신규 TypeScript 오류는 위 명령 출력에서는 확인되지 않았다.

## Run Metadata

- generated_at: `2026-04-17T12:52:59`
- watcher_exit_code: `0`
- codex_tokens_used: `117,292`
