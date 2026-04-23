# Result: TASK-2026-04-23-0557-programs-listing-page-restructure

## Changed files

- `frontend/app/(landing)/programs/page.tsx`
- `reports/TASK-2026-04-23-0557-programs-listing-page-restructure-result.md`
- `docs/refactoring-log.md`

## Why changes were made

- Supervisor inspection에서 지적한 active filter chip URL 보존 리스크를 확인했다.
- 비용 필터 chip을 제거할 때 `sources`, `targets`, `selection_processes`, `employment_links`가 removal href에서 빠져 다른 활성 필터가 함께 사라질 수 있었다.
- 해당 chip href에 누락된 필터 파라미터를 추가해 필터 제거 동작이 다른 조건을 보존하도록 보완했다.

## Preserved behaviors

- `/programs`의 맞춤 추천, 마감 임박, 전체 프로그램 3개 섹션 구조는 유지했다.
- `ProgramSort`는 계속 `deadline | latest`만 사용하며, 과거 `recommended`/`popular` query는 기존 `deadline` fallback을 유지한다.
- 마감 임박 섹션은 전체 프로그램 현재 페이지 결과가 아니라 별도 `deadline` fetch 결과에서 D-7 이내 표시 가능한 프로그램만 파생하는 구조를 유지했다.
- 비로그인 추천 CTA의 `redirectedFrom` 보존, placeholder 공개 카드, 필수 표시 필드(`title`, `source`, `deadline`) 필터링은 변경하지 않았다.
- 기존 Task 0555/0556 변경 및 dirty worktree의 다른 파일은 덮어쓰지 않았다.

## Drift from original packet and handling

- `HEAD`는 inspector 보고서 기준 `planned_against_commit`과 일치했고, 구현 전 새 drift는 발견하지 못했다.
- 현재 worktree에는 선행 Task 0555/0556 변경이 uncommitted 상태로 섞여 있지만, task packet과 supervisor inspection이 이를 baseline으로 승인한 상태라 drift report를 작성하지 않았다.
- 이번 step은 구조 재구현이 아니라 승인된 구현의 잔여 gap 보완으로 제한했다.

## Risks / possible regressions

- 이번 수정은 비용 filter chip removal href에만 국한되어 리스크는 낮다.
- `/programs` page diff 자체에는 선행 작업의 큰 구조 변경이 함께 포함되어 있어, 최종 verification gate에서 전체 `/programs` 상호작용을 다시 확인해야 한다.
- 마감 임박 섹션은 별도 `limit: 12` fetch 후 D-7 필터링을 하므로, 조건이 매우 희소한 경우 섹션이 숨겨질 수 있다. 이는 packet에서 허용한 현재 방식이다.

## Follow-up refactoring candidates

- `buildProgramsHref`와 `renderActiveFilters`의 반복 파라미터 전달을 작은 shared helper로 줄이면 chip별 누락 리스크를 낮출 수 있다.
- `/programs` URL 파라미터 normalize/build 로직을 순수 함수로 분리하면 프론트 단위 테스트를 추가하기 쉽다.
- 필터 옵션과 backend allowed set을 장기적으로 공통 계약 문서 또는 generated type으로 맞추면 UI/API 불일치 가능성을 줄일 수 있다.

## Verification results

- `frontend`: `npx tsc --noEmit --project tsconfig.json` 통과.
- `frontend`: `npm run lint` 통과. `next lint` deprecation 안내만 출력됨.
- `backend`: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_programs_router.py -q` 통과, `40 passed`. Python 3.10 지원 종료 예정 및 일부 SWIG deprecation warning만 출력됨.
- `git diff --check -- 'frontend/app/(landing)/programs/page.tsx'` 통과. Windows 환경의 LF to CRLF 안내만 출력됨.

## Run Metadata

- generated_at: `2026-04-23T06:56:29`
- watcher_exit_code: `0`
- codex_tokens_used: `290,169`

## Git Automation

- status: `merged-main`
- branch: `develop`
- commit: `c664c391ada70a5da0dc99d13186ac8508a6bb10`
- note: [codex] TASK-2026-04-23-0557-programs-listing-page-restructure 구현 완료. Auto-promoted to origin/main.
