# TASK-2026-04-15-1700-recommend-data-pipeline Blocked

## Summary

로컬 backend는 `backend/` 작업 디렉터리 기준으로 import 및 앱 초기화가 가능했다. 그러나 `POST /admin/sync/programs` 검증 중 Supabase `programs` 테이블 스키마 불일치가 발생해 task를 완료할 수 없다.

## Verification Performed

1. `backend/venv/Scripts/python.exe -c "from main import app"` 기준으로 앱 import 확인
2. FastAPI `TestClient`로 `/health` 호출 확인
3. `POST /admin/sync/programs?max_pages=1` 호출
4. `POST /programs/recommend` 호출

## Observed Results

- `/health`: `200 OK`
- `/programs/recommend`: `200 OK`
  - 기본 추천 경로에서 `items` 3건 반환 확인
- `/admin/sync/programs?max_pages=1`: `500 Internal Server Error`
  - 응답 detail:
    `Supabase request failed: Could not find the 'is_certified' column of 'programs' in the schema cache`

## Runtime Blocker

현재 backend `backend/routers/admin.py` 의 sync payload에는 `is_certified` 필드가 포함되어 있다. 하지만 실제 연결된 Supabase `programs` 스키마 캐시에 해당 컬럼이 없어 upsert 단계에서 실패한다.

- failing flow: `backend/routers/admin.py` -> `request_supabase(... POST /rest/v1/programs ...)`
- external dependency state: connected Supabase schema does not match current backend payload

## Impact

- `POST /admin/sync/programs` 실행 불가
- sync 기반 최신 데이터 적재 검증 불가
- 따라서 `TASK-2026-04-15-1710-recommend-api-enhance` 진행 가능 기준은 아직 충족되지 않음

## Notes

- 이 문제는 현재 확인 범위에서 코드 드리프트가 아니라 운영 런타임 blocker다.
- 추천 API 자체는 기존 `programs` 데이터로 비어 있지 않은 응답을 반환했다.
