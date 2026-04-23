# Supervisor Verification: TASK-2026-04-24-1030-program-list-followup-hardening

## Verification Summary

Inspection handoff가 요구한 범위와 실제 구현은 대체로 일치한다. `backend/routers/programs.py`에는 promoted layer 진입 조건을 `unfiltered first-page browse`로 제한하는 `_is_default_browse_entry_request()` helper가 추가됐고, `backend/tests/test_programs_router.py`에는 해당 계약과 promoted dedupe 회귀 테스트가 보강됐다. `frontend/lib/types/index.ts`와 `frontend/app/(landing)/programs/page.tsx`도 `promoted_items`를 required contract로 맞췄다.

`docs/current-state.md`와 `docs/refactoring-log.md`에는 이 task 관련 기록이 반영되어 있다. 다만 두 문서는 현재 같은 날짜의 다른 작업 변경도 함께 포함하고 있으므로, 본 검증은 이 task 관련 hunk 기준으로 일치 여부를 판단했다.

## Checks Reviewed

- Result report에 기록된 backend check를 재실행했다: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- 결과: `106 passed`
- Result report에 기록된 frontend type check를 재실행했다: `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`
- 결과: 성공, 추가 출력 없음
- 테스트 범위는 touched area 기준으로 충분하다. backend는 query/filter/cursor/promoted layer 회귀를 직접 고정하고 있고, frontend는 required `promoted_items` 계약 변경이 타입 수준에서 깨지지 않는지 확인한다.

## Result Report Consistency

- `backend/routers/programs.py`: report 요약과 일치한다. promoted fetch 진입 조건이 helper로 분리되어 filtered browse/search/archive/offset/cursor 경로에서 promoted layer가 섞이지 않도록 제한됐다.
- `backend/tests/test_programs_router.py`: report 요약과 일치한다. unfiltered first-page browse 계약, filtered browse에서 promoted fetch skip, explicit ad/provider fallback dedupe 테스트가 추가됐다.
- `frontend/lib/types/index.ts`: report 요약과 일치한다. `ProgramListPageResponse.promoted_items`가 optional에서 required로 변경됐다.
- `frontend/app/(landing)/programs/page.tsx`: report 요약과 일치한다. `promoted_items ?? []` fallback이 제거되고 required contract를 직접 사용한다.
- `docs/current-state.md`, `docs/refactoring-log.md`: task 관련 기록은 report와 일치한다. 다만 동일 파일에 다른 2026-04-24 작업 변경도 함께 존재하므로, 현재 worktree 전체가 아니라 task 관련 hunk 기준으로 일치 판정했다.
- `tasks/running/TASK-2026-04-24-1030-program-list-followup-hardening.md`는 현재 0바이트다. 다만 동일 task의 `cowork/packets/...` 원본, inspection report, result report, 구현 변경이 모두 남아 있어 이번 verification 자체를 막는 blocker로 보지는 않았다.

## Residual Risks

- promoted fallback 정책은 여전히 `PROGRAM_PROMOTED_PROVIDER_MATCHES` 문자열 규칙에 의존한다. 운영 정책이 바뀌면 helper 조건은 유지돼도 sponsor 선별 기준은 다시 흔들릴 수 있다.
- shared docs 파일(`docs/current-state.md`, `docs/refactoring-log.md`)은 동시 작업과 쉽게 충돌할 수 있다. 이번 task 관련 문구는 맞지만, 이후 audit에서는 task별 hunk 분리 관리가 더 안전하다.
- `tasks/running` packet이 비어 있는 상태는 watcher audit 측면에서 추적성을 떨어뜨릴 수 있다. 구현 검증은 가능했지만 운영 workflow 차원에서는 개선 여지가 있다.

## Final Verdict

- verdict: pass
