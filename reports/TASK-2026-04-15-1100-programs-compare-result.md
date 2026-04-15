# TASK-2026-04-15-1100-programs-compare Result

## Changed Files
- `frontend/app/programs/compare/page.tsx`
- `frontend/app/programs/compare/programs-compare-client.tsx`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `supabase/migrations/20260415113000_add_compare_meta_to_programs.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made
- `/programs/compare` 공개 페이지를 추가해 `?ids=` URL 기반으로 최대 3개 프로그램을 비교할 수 있게 했다.
- 비교 페이지는 서버에서 `getProgram` / `listPrograms`만 사용해 초기 데이터를 가져오고, 클라이언트에서는 `router.replace`로 비교 대상 추가/제거와 URL 정규화를 처리한다.
- `compare_meta` 타입과 schema를 추가해 모집 대상, 지원 허들, 커리큘럼 비교 데이터를 안전하게 표현할 수 있게 했다.
- backend `ProgramListItem`에도 `compare_meta`를 반영해 프로그램 응답 shape와 추천 응답 shape의 타입 괴리를 줄였다.
- 현재 상태 문서와 리팩토링 로그에 새 compare route와 `compare_meta` 컬럼을 짧게 반영했다.

## Preserved Behaviors
- 기존 `/programs` 목록 페이지와 `/programs/[id]` 상세 페이지는 수정하지 않았다.
- 프로그램 데이터는 브라우저에서 Supabase를 직접 호출하지 않고 기존 backend API 경유 패턴을 유지했다.
- compare page는 middleware 변경 없이 공개 접근 상태를 유지한다. 현재 middleware는 `/onboarding`, `/dashboard`만 보호한다.
- `application_url`이 없는 경우 compare CTA는 비활성화하고, 이력서 CTA는 로그인 여부에 따라 `/dashboard/resume` 또는 `/login`으로 분기한다.

## Checks
- `frontend`: `npx tsc --noEmit` ✅
- `frontend`: `npm run lint` 실행 시 Next.js가 새 ESLint 초기 설정을 요구해 비대화형 검증 불가
- `backend`: `python -m pytest backend/tests/test_programs_router.py` 실행 시 `pytest` 미설치로 검증 불가

## Risks / Possible Regressions
- `compare_meta`의 실제 값 표준화가 아직 강제되지 않아, 예상 밖 문자열이 들어오면 일부 허들 항목은 보수적으로 `warn` 또는 원문 표시로 보일 수 있다.
- 추천 프로그램은 현재 `listPrograms(limit=8)` 결과에서 비교 중인 id를 제외한 앞 4개를 사용하므로, 데이터 분포에 따라 추천 다양성이 낮을 수 있다.
- invalid / duplicate / 404 id는 첫 렌더에서 빈 슬롯으로 보인 뒤 URL 정규화로 제거되므로, 직접 입력한 비정상 URL은 한 번의 replace 후 안정화된다.

## Follow-up Refactoring Candidates
- compare grid 행/섹션 정의를 데이터 배열 기반으로 한 단계 더 추출하면 반복 JSX를 줄일 수 있다.
- `compare_meta` 값 표준을 backend 또는 ingestion 단계에서 enum/validator로 고정하면 허들 badge 분기 로직을 더 단순하게 만들 수 있다.
- compare page용 공통 formatting helper를 `/programs` 목록/상세와 공유하면 D-day, 날짜 포맷, skill/tag 정규화 중복을 줄일 수 있다.

## Git Automation
- 시도 결과 현재 환경에서는 `.git` 디렉터리에 쓰기 권한이 없어 `git add` 단계에서 중단됨
- 따라서 `[codex] TASK-2026-04-15-1100-programs-compare 구현 완료` commit / push 는 이 실행에서는 수행하지 못함

## Run Metadata

- generated_at: `2026-04-15T14:08:20`
- watcher_exit_code: `0`
- codex_tokens_used: `132,413`

## Git Automation

- status: `watcher-sync-failed`
- note: CalledProcessError: Command '['git', 'add', '-A', '--', 'tasks/running/TASK-2026-04-15-1100-programs-compare.md', 'tasks/done/TASK-2026-04-15-1100-programs-compare.md', 'reports/TASK-2026-04-15-1100-programs-compare-result.md']' returned non-zero exit status 128.
