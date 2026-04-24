# SESSION-2026-04-24 admin program source records dual write seed

## 변경 파일
- `backend/routers/admin.py`
- `backend/tests/test_admin_router.py`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 패키지 3의 남은 항목 중 `programs` 적재 dual write를 최소 범위로 전진시키기 위해, 실제 운영 적재 진입점인 `POST /admin/sync/programs`에 `program_source_records` best-effort seed를 연결했다.
- 이미 진행 중이던 추천 정본 refresh 연결 다음으로, 현재 패키지를 끝내는 데 직접 필요한 프로그램 provenance seed만 추가했다.

## 변경 내용
- `admin.py`에 `program_source_records` upsert payload builder를 추가했다.
- `programs` upsert가 성공하면 같은 normalized payload를 기반으로 `raw_payload`, `field_evidence`, `normalized_snapshot`, `source_specific`을 조립해 `program_source_records` upsert를 시도한다.
- 새 provenance 경로는 soft-fail이다. 테이블/인덱스/컬럼이 아직 없는 환경에서는 경고만 남기고 기존 `programs` sync는 그대로 성공한다.
- 관련 테스트로 provenance row 조립과 missing-table soft-fail을 고정했다.

## 유지한 동작
- 기존 `POST /admin/sync/programs`의 `programs` 저장 성공/실패 기준은 바꾸지 않았다.
- Chroma sync 흐름과 반환 응답 shape는 그대로 유지했다.
- 새 provenance 경로가 실패해도 기존 관리자 sync는 중단되지 않는다.

## 리스크 / 가능한 회귀
- 현재는 admin sync 경로만 seed 되었고 collector scheduler는 아직 direct `programs` upsert 위주라, 모든 적재 경로가 완전히 같은 dual write 상태는 아니다.
- `program_source_records` unique/index 구성이 예상과 다르면 provenance write는 경고 후 건너뛴다. 기존 동작은 유지되지만 새 테이블 적재율은 환경에 따라 달라질 수 있다.

## 검증
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_admin_router.py -q`
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\admin.py`

## 후속 리팩토링 후보
- collector scheduler도 같은 provenance helper를 재사용하도록 맞추기
- `programs.primary_source_*`와 canonical 컬럼까지 ingest 단계에서 함께 채우는 2차 dual write
- 이후 패키지 4에서 상세/비교 read를 `programs + program_source_records` 기준으로 옮기기
