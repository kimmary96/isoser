# 프로그램 상세 로딩 개선 결과

## changed files

- `frontend/lib/api/backend.ts`
- `frontend/lib/api/backend-endpoint.ts`
- `frontend/lib/server/program-detail-fallback.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 프로그램 상세 SSR이 backend detail 응답을 timeout 없이 기다려, Supabase/backend 지연 시 첫 화면 로딩이 길어질 수 있었다.
- backend detail API가 `programs select=*`로 raw collector payload까지 읽어 상세 응답에 필요 없는 무거운 컬럼이 병목 후보가 됐다.

## preserved behaviors

- `/programs/{id}` route, 상세 UI, 404 처리, 북마크, 공유, 신청 링크, detail-view 집계 호출은 유지했다.
- backend detail 실패 시 Supabase direct fallback으로 상세 데이터를 조립하는 기존 보호 경로를 유지했다.
- 운영 DB에 없는 `programs.application_url`, `programs.verified_self_pay_amount`는 select에서 제외하고, source record/link/meta 기반 fallback을 유지했다.

## risks / possible regressions

- detail select가 명시 컬럼 기반이므로 운영 DB 스키마가 더 오래된 환경에서는 추가 누락 컬럼이 드러날 수 있다.
- 3.5초 timeout으로 backend가 매우 늦게 성공하는 경우에도 fallback 경로가 사용될 수 있다.

## follow-up refactoring candidates

- 상세 section builder를 순수 helper로 분리해 프론트 렌더 계약 테스트를 추가한다.
- `detail-view` 집계는 화면 hydration 이후 best-effort background call로 더 분리하고, 실패 상태를 UI 흐름과 완전히 끊는다.
- 상세 API도 read-model detail projection 또는 RPC로 묶어 Supabase round trip을 줄인다.

## verification

- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "program_detail_select or get_program_detail_uses_lightweight_detail_select or get_program_details_batch_reuses_detail_mapping or build_program_detail_response"`: passed
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\tests\test_programs_router.py`: passed
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`: passed
- `npm --prefix frontend run lint -- --file lib/api/backend.ts --file lib/api/backend-endpoint.ts --file lib/server/program-detail-fallback.ts`: passed
- Local smoke: `GET http://127.0.0.1:8000/programs/{id}/detail` returned 200 in 501ms for sample id `9d5cfab1-8d49-4184-992c-53b5c4355988`.
- Local smoke: `GET http://127.0.0.1:3001/programs/{id}` returned 200 in 802ms and included the sample program title.
- Local smoke: `GET http://127.0.0.1:3000/programs/{id}` returned 200 in 2268ms and included the sample program title.

## note

- Full `backend\tests\test_programs_router.py -q` was also run. It still has 5 failures where existing TestClient tests unexpectedly hit live Supabase/auth instead of the monkeypatched helpers; those failures were outside this touched path and reproduced in filter/calendar/raw single-program tests.
