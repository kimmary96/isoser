# SESSION-2026-04-24 package-4 detail compare read switch result

## 변경 파일
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 패키지 4의 남은 핵심 중 하나가 상세/비교 read를 새 정본 축에 맞추는 일이었기 때문이다.
- 상세는 `programs` 정본과 `program_source_records` provenance를 같이 읽어야 하고, compare 상단 카드 batch는 `program_list_index` 요약값을 먼저 읽어야 화면별 값 drift를 줄일 수 있다.

## 실제 변경
- `get_program_detail()`와 `get_program_details_batch()`가 이제 `program_source_records` primary row를 함께 읽어 `application_url`, `detail_url`, `source_specific` 기반 상세 보강을 수행한다.
- `_build_program_detail_response()`는 additive canonical detail 필드(`provider_name`, `organizer_name`, `location_text`, `business_type`, `curriculum_items`, `certifications`, `service_meta` 등)를 legacy `compare_meta`보다 먼저 사용한다.
- `get_programs_batch()`는 `program_list_index` summary read를 먼저 시도하고, read model에 없는 id만 legacy `programs`로 fallback 한다.

## 유지한 동작
- public 응답 shape는 그대로 유지했다.
  - 상세: `ProgramDetailResponse`
  - batch: `ProgramBatchResponse`
- read model이 비어 있거나 일부 id가 누락돼도 기존 `programs` fallback으로 계속 응답한다.
- `program_source_records`가 아직 없는 환경에서도 저장소 테스트 기준 기존 상세 경로가 깨지지 않도록 보수적으로 연결했다.

## 리스크 / 가능한 회귀
- compare 상단 카드는 이제 read model 값을 더 우선 보므로, read model refresh가 늦은 환경에서는 legacy `programs`와 값 차이가 더 빨리 드러날 수 있다.
- 상세 보강은 `program_source_records.source_specific` 품질에 따라 섹션 채움 정도가 달라질 수 있다.
- `/programs/{id}` 단건 legacy 요약 read는 아직 별도 read-model-first 전환을 하지 않았다.

## 검증
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q`
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py`

## 추가 리팩토링 후보
- compare consumer가 `Program` monolith 대신 compare 전용 summary 타입을 직접 쓰도록 축소
- `/programs/{id}` legacy 단건 요약 endpoint도 `program_list_index` 우선 구조로 정리
- 상세/비교 consumer에서 transition-only fallback 필드 정리
