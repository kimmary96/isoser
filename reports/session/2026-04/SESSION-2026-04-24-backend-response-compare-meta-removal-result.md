# Backend Response Compare Meta Removal Result

## Changed files
- `backend/routers/programs.py`
- `backend/tests/test_ai_smoke.py`
- `backend/tests/test_programs_router.py`

## Why changes were made
- `compare_meta`는 내부 legacy fallback과 provenance 보조 용도로는 아직 남아 있지만, API 응답 정본으로 계속 노출할 이유는 줄어들었다.
- live 확인 기준으로 읽기 응답에 필요한 값은 이미 canonical field 또는 `service_meta` 쪽으로 옮겨졌고, `compare_meta`는 응답보다 내부 보조 데이터 성격이 강해졌다.
- 그래서 가장 작은 안전 변경으로 응답 모델 `ProgramListItem`과 raw 단건 응답에서 `compare_meta`만 제거했다.

## Preserved behaviors
- 추천/목록/배치/캘린더 응답의 기존 기본 필드 구조는 유지했다.
- `GET /programs/{program_id}`의 단건 raw 응답도 나머지 응답 축과 같은 원칙으로 `compare_meta`만 숨기고 나머지 필드는 유지했다.
- backend 내부의 `compare_meta` fallback 로직과 search/scoring/detail builder 동작은 그대로 유지했다.
- `programs.compare_meta` DB 컬럼이나 내부 serializer 입력 구조는 제거하지 않았다.

## Risks / possible regressions
- 저장소 밖 외부 클라이언트가 비공식적으로 `program.compare_meta`를 직접 읽고 있었다면 응답에서 더 이상 해당 필드를 받지 못한다.
- 내부 fallback 로직은 유지했기 때문에 서버 동작 리스크는 낮지만, 외부 소비자 의존성은 저장소 기준으로만 판단했다.
- 현재 로컬 worktree에는 별도 schema 분리 리팩토링이 진행 중이라, 이번 커밋은 그 큰 변경을 포함하지 않고 router 기준 최소 패치로만 분리했다.

## Tests
- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_ai_smoke.py -k "program_recommend_smoke"`
- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_programs_router.py -k "program_list_item_response_model_omits_compare_meta or serialize_program_recommendation_uses_card_summary_serializer or get_program_omits_compare_meta_in_raw_response or get_program_returns_404_for_invalid_uuid"`
- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_assistant_router.py -k "routes_to_recommendation or routes_to_calendar_recommendation"`
- `git diff --check`

## Follow-up refactoring candidates
- backend 응답별로 `ProgramListItem` 외 개별 serializer가 `compare_meta`를 우회 노출하는 경로가 없는지 추가 확인
- `program_list_index.compare_meta` 응답 의존 제거 후 전체 live row 기준 backfill/validation 재판정
- provenance 성격 키를 `field_evidence` 또는 `program_source_records.source_specific`로 더 내린 뒤 `programs.compare_meta` DB 제거 시점 재판정
