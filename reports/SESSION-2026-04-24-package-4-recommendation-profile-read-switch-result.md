# SESSION-2026-04-24-package-4-recommendation-profile-read-switch-result

## changed files
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/program-recommendation-backend-touchpoints-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## why changes were made
- 패키지 4 우선순위대로 backend 추천/비교 read를 `user_recommendation_profile` 중심으로 옮기기 위해 변경했다.
- 기존 추천 cache key가 raw profile snapshot에 묶여 있어 새 정본과 drift가 생기던 문제를 줄이기 위해 `recommendation_profile_hash` 우선 사용으로 맞췄다.
- 새 정본에 이미 계산돼 있는 `effective_target_job`, `desired_skills`, `profile_keywords`, `activity_keywords`가 실제 추천/비교 계산에 반영되도록 `programs_rag` 입력 해석을 보강했다.

## preserved behaviors
- `POST /programs/recommend`, `GET /programs/recommend/calendar`, `POST /programs/compare-relevance`의 공개 응답 shape는 유지된다.
- `user_recommendation_profile` 테이블이나 컬럼이 아직 없는 환경에서는 기존 `profiles` read로 fallback 한다.
- 요청에서 `job_title`을 직접 덮어쓰는 현재 추천 API 동작은 유지된다.

## risks / possible regressions
- derived profile이 있는 사용자는 recommendation cache miss가 한 번 더 발생할 수 있다. 새 hash 기준으로 정상 재생성되는 방향의 변화다.
- compare/recommend 계산이 `target_job`과 `desired_skills`를 더 직접 반영하게 되므로, 일부 사용자는 이전보다 관련도 순서가 달라질 수 있다.
- raw `activities`는 아직 보조 입력으로 남아 있어, 패키지 4 전체 완료 전까지는 완전한 derived-only read는 아니다.

## tests
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\rag\programs_rag.py`

## follow-up refactoring candidates
- `recommended-programs` / `recommend-calendar` BFF의 transition field 정리
- compare/detail read를 `program_list_index` / `program_source_records` 조합에 더 직접 맞추기
- derived profile bridge를 legacy profile dict 대신 명시 타입으로 분리
