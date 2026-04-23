# TASK-2026-04-24-1030-program-list-followup-hardening Result

## Summary

`/programs/list` read-model promoted layer를 unfiltered first-page browse entry contract로 고정했다. filtered browse/search/archive/offset/cursor 경로에서는 promoted fetch를 건너뛰고 organic query만 유지하도록 정리했으며, explicit ad row와 provider-match fallback row가 같은 프로그램을 가리켜도 promoted layer 내부 중복이 생기지 않도록 테스트로 고정했다. frontend 타입도 `promoted_items` required field로 맞춰 backend 응답 계약을 명확히 했다.

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/types/index.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- promoted layer를 browse 1페이지 진입 계약으로 제한해 query/filter 결과와 스폰서 레이어가 섞이는 모호함을 줄이기 위해
- sponsored fallback과 explicit ad가 같은 프로그램을 가리킬 때 중복 노출이 재발하지 않도록 하기 위해
- frontend/backend가 `promoted_items` 존재 여부를 다르게 해석하지 않도록 타입 계약을 맞추기 위해

## Preserved behaviors

- `GET /programs/list`는 계속 `promoted_items`와 organic `items`를 분리해 반환한다
- organic read-model query는 계속 `is_ad=false`로 유지된다
- 기본 browse 1페이지에서만 promoted layer를 조회하는 흐름은 유지된다
- 메인 목록의 offset 기반 UX와 기존 read-model/legacy fallback 구조는 유지된다

## Risks / possible regressions

- 현재 promoted layer는 unfiltered browse entry contract로 더 보수적으로 제한됐으므로, 필터된 browse에서도 sponsor 노출을 기대하던 운영 가정이 있었다면 노출량이 줄 수 있다
- provider-match fallback은 여전히 dedicated promotion model이 아니라 `PROGRAM_PROMOTED_PROVIDER_MATCHES` 문자열 규칙에 의존한다

## Tests

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- `npx --prefix frontend tsc -p frontend/tsconfig.codex-check.json --noEmit`

## Follow-up refactoring candidates

- promoted layer 진입 조건을 helper 하나로 쓴 만큼, 향후 운영 정책이 확정되면 backend/frontend 공용 contract 문서 또는 enum 상수로 분리
- provider-match fallback을 search text 기반 휴리스틱 대신 dedicated promotion source metadata로 교체

## Run Metadata

- generated_at: `2026-04-24T00:37:35`
- watcher_exit_code: `0`
- codex_tokens_used: `317,710`
