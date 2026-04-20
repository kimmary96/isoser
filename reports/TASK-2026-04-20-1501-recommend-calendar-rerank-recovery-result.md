# TASK-2026-04-20-1501-recommend-calendar-rerank-recovery Result

## Changed files
- `backend/rag/programs_rag.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 추천 엔진의 최종 점수 공식을 task 기준에 맞게 `relevance_score * 0.6 + urgency_score * 0.4`로 복구했다.
- recommendation cache read에서 저장된 과거 `final_score`를 그대로 신뢰하지 않고 component score로 재계산하도록 바꿨다.
- component score가 하나라도 빠진 cache row는 stale로 보고 fresh recommendation path로 우회하도록 처리했다.
- 캘린더 전용 backend endpoint `GET /programs/recommend/calendar`와 frontend BFF `GET /api/dashboard/recommend-calendar`를 추가했다.
- 캘린더 응답은 `{ items: CalendarRecommendItem[] }` 계약으로 고정하고, 만료 프로그램 제외 및 `final_score desc`, `deadline asc` 정렬을 캘린더 경로에만 적용했다.

## Preserved behaviors
- 기존 `POST /programs/recommend` top-level 응답 shape `{ items: [...] }`는 유지했다.
- 기존 `frontend/app/api/dashboard/recommended-programs/route.ts`의 `{ programs: [...] }` 계약은 변경하지 않았다.
- 추천 엔진 자체는 기존 `ProgramsRAG` 구조를 재사용했고, router에서 transport/cache/calendar 전용 규칙만 보강했다.
- 비로그인 추천도 계속 200 응답을 반환하며, 기존 카드 추천 경로는 유지했다.

## Verification
- `backend/venv/Scripts/python.exe -m pytest backend/tests/test_programs_router.py`
- `frontend/node_modules/.bin/tsc.cmd --noEmit`

## Risks / possible regressions
- 캘린더 endpoint는 cache read 후 calendar-specific filtering/sorting을 한 번 더 적용하므로, 이후 추천 카드 endpoint와 캘린더 endpoint를 동일 데이터 소스로 합치려면 helper 경계 재정리가 필요하다.
- deadline이 없는 프로그램은 task 기준대로 유지되지만 `d_day_label`은 현재 `"정보 없음"`으로 채워진다. 향후 UI 계약에서 다른 표기를 요구하면 frontend/backend를 함께 맞춰야 한다.
- 문서 파일 두 개는 기존 로컬 수정 위에 task-scoped note만 덧붙였다. 이후 다른 작업과 병합할 때 문단 재정리가 필요할 수 있다.

## Follow-up refactoring candidates
- recommendation cache normalize/build logic를 별도 helper module로 분리해 `POST /programs/recommend`와 `GET /programs/recommend/calendar`의 공통 분기를 더 명확하게 만들기.
- 캘린더용 `d_day_label`/deadline formatting 규칙을 frontend와 공유 가능한 공용 유틸로 승격하기.

## Run Metadata

- generated_at: `2026-04-20T15:45:48`
- watcher_exit_code: `0`
- codex_tokens_used: `229,817`

## Git Automation

- status: `push-failed`
- branch: `develop`
- commit: `c297240c32b48f454167b8628ddccd6e5841145b`
- note: To https://github.com/kimmary96/isoser.git
 ! [rejected]        develop -> develop (non-fast-forward)
error: failed to push some refs to 'https://github.com/kimmary96/isoser.git'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart. If you want to integrate the remote changes,
hint: use 'git pull' before pushing again.
hint: See the 'Note about fast-forwards' in 'git push --help' for details.
