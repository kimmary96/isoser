# Result: TASK-2026-04-15-1700-recommend-data-pipeline

## Summary

추천 데이터 파이프라인이 중단된 직접 원인은 `POST /admin/sync/programs`가 연결된 Supabase `programs` 스키마와 현재 backend payload 사이의 불일치를 흡수하지 못했기 때문이다. 기존 blocker였던 누락 컬럼(`is_certified` 등)과 hybrid unique constraint 충돌(`programs_unique`, `programs_hrd_id_key`)을 admin sync에서 후방 호환적으로 처리하도록 수정했고, 현재 로컬 backend 기준으로 sync와 추천 baseline을 다시 검증했다.

## Changed files

- `backend/routers/admin.py`
- `backend/tests/test_admin_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-15-1700-recommend-data-pipeline-result.md`

## Why changes were made

- 운영 DB의 `programs` 테이블이 저장소 migration과 완전히 일치하지 않아, batch upsert가 `is_certified` 누락과 unique constraint 충돌에서 멈추고 있었다.
- 이 task의 목표는 schema redesign이 아니라 현재 운영 상태에서 추천 데이터 파이프라인이 실제로 동작하는지 검증하는 것이므로, admin sync가 hybrid schema를 견디도록 최소 보정이 필요했다.

## Verification performed

1. `backend/venv/Scripts/python.exe -m pytest backend/tests/test_admin_router.py backend/tests/test_programs_router.py backend/tests/test_scheduler_collectors.py -q`
2. FastAPI `TestClient` 기준 runtime check
   - `GET /health` -> `200 OK`
   - `POST /programs/recommend` with `{"top_k": 3}` -> `200 OK`, `items` 3건 반환
   - `POST /admin/sync/programs?max_pages=1` -> `200 OK`, `{"synced": 100, "chroma_synced": 148, "chroma_skipped": 0, "duration_seconds": 30.844}`

## Why the task had stopped before

- 기존 blocked report의 1차 원인:
  - `programs.is_certified` 컬럼이 운영 스키마에 없어 upsert가 즉시 실패
- 실제 재검증에서 드러난 추가 원인:
  - 운영 DB가 `hrd_id` unique와 `(title, source)` unique를 함께 가진 hybrid 상태라 batch `on_conflict=hrd_id` upsert가 `programs_unique` / `programs_hrd_id_key` 충돌에서 중단

## Preserved behaviors

- Work24 fetch -> Supabase upsert -> Chroma sync 시도라는 기존 admin sync 흐름은 유지했다.
- 추천 API `/programs/recommend`의 request/response shape와 기본 추천 fallback 동작은 바꾸지 않았다.
- migration 파일은 수정하지 않았다.

## Risks / possible regressions

- row-by-row fallback과 embedding 재시도 때문에 sync 시간은 외부 quota 상태에 따라 늘어날 수 있다. 현재 검증에서는 `max_pages=1` 기준 `30.844s`였다.
- Gemini quota가 부족하면 local deterministic embedding fallback으로 전환되므로, 검색 품질은 Gemini embedding 대비 다소 낮아질 수 있다. 다만 sync/search 자체는 계속 진행된다.
- 대시보드의 인증 포함 추천 경로는 이번 검증에서 실제 사용자 access token으로 호출하지는 못했다. 다만 backend `/programs/recommend` baseline과 frontend proxy 경로는 확인했다.

## Follow-up refactoring candidates

- Supabase `programs` 스키마를 migration 기준으로 정리해 admin sync가 다시 batch upsert 위주로 동작하게 만들기
- row-by-row fallback 전에 기존 row lookup을 batch query로 줄여 sync 시간을 단축하기
- local fallback embedding 품질을 측정하고, quota 회복 후 Gemini embedding으로 재색인하는 maintenance 명령을 추가하기

## Conclusion

- 이 task의 최소 기준선은 충족됐다.
- `POST /admin/sync/programs`는 현재 운영 스키마에서도 성공한다.
- `/programs/recommend`는 비어 있지 않은 추천 baseline을 반환한다.
- 따라서 `TASK-2026-04-15-1710-recommend-api-enhance`는 데이터 기반 확보 관점에서 진행 가능하다.
