# Session Result: program-supabase-config-recovery

## Changed files

- `backend/utils/supabase_admin.py`
- `frontend/lib/supabase/server.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 랜딩 `/programs`, 랜딩 추천 경로, 대시보드 추천/북마크 BFF 공통 장애 원인을 먼저 재현한 결과, local backend `127.0.0.1:8000`의 `/programs/list`, `/programs/count`, `/programs/recommend/calendar`가 모두 `503 {"detail":"Supabase is not configured"}`를 반환했다.
- 실제 파일 상태를 확인하면 `frontend/.env.local`과 `backend/.env`에는 Supabase URL/key가 존재했으므로, 핵심 문제는 “값 부재”보다 “실행 중인 프로세스가 그 env를 못 읽는 상태”였다.
- 이를 완화하기 위해 backend/Next server 양쪽 모두 process env 우선 원칙은 유지하면서, 로컬 operator session에서는 env 파일 재해석 fallback을 추가했다.

## Preserved behaviors

- 기존 우선순위인 process env -> runtime client 생성 흐름은 유지했다.
- public API contract와 응답 shape는 바꾸지 않았다.
- Supabase anon/service-role 사용 구분도 유지했다.

## Verification

- Passed: `npm --prefix frontend run lint -- --file lib/supabase/server.ts`
- Passed: `python -` probe with `backend.utils.supabase_admin.get_supabase_admin_settings()` returned resolved Supabase URL, timeout, and service-role prefix after the fallback change.
- Passed: `python -` probe with `request_supabase(method='GET', path='/rest/v1/programs', params={'select': 'id,title', 'limit': '1'})` returned a real row through the hardened backend config path.
- Passed on fresh process: `GET http://127.0.0.1:8001/health`
- Passed on fresh process: `GET http://127.0.0.1:8001/programs/list?limit=3`

## Risks / possible regressions

- local env file parsing은 단순 `KEY=value` 형식을 기준으로 하므로, 복잡한 multiline env 문법에는 대응하지 않는다.
- 이 세션의 `127.0.0.1:8000` listener는 stale process로 남아 있어, 현재 떠 있는 오래된 서버를 자동으로 교체하지는 못했다.
- 브라우저용 `createBrowserClient()`는 클라이언트 번들 특성상 파일 fallback을 쓸 수 없으므로, 클라이언트 빌드 타임 env 누락 문제는 별도다.

## Follow-up refactoring candidates

- frontend/server 쪽 env file reader를 별도 공용 helper로 분리해 `calendar-selections`의 중복 로컬 env 파서와 합친다.
- local dev start 스크립트에서 backend/frontend env sanity check를 먼저 수행해 stale process와 env drift를 더 빨리 드러나게 한다.
- stale listener를 자동 탐지해 현재 코드 버전과 맞지 않으면 경고하는 local health-check 스크립트를 추가한다.
