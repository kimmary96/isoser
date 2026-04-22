# TASK-2026-04-22-1915-work24-deadline-source-separation Result

## 변경 파일
- `backend/rag/collector/program_field_mapping.py`
- `backend/routers/admin.py`
- `scripts/program_backfill.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `backend/tests/test_admin_router.py`
- `backend/tests/test_program_backfill.py`
- `cowork/packets/TASK-2026-04-22-1915-work24-deadline-source-separation.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 고용24 API의 `traEndDate`는 훈련 종료일인데, 기존 mapping이 이를 `raw_deadline`으로 넘겨 `programs.deadline`에 저장할 수 있었다.
- 관리자 sync 경로도 `deadline=end_date`를 직접 저장해 같은 오표시가 반복될 수 있었다.
- 기존 운영 DB 값은 바로 수정하지 않고, 의심 row를 먼저 식별할 수 있는 dry-run 리포트가 필요했다.

## 보존한 동작
- 고용24 훈련 시작/종료일은 계속 `start_date`/`end_date`로 저장된다.
- 고용24 훈련 종료일은 `compare_meta.training_end_date`에도 보존된다.
- K-Startup의 신청 종료일 `pbanc_rcpt_end_dt`는 기존처럼 `deadline`과 `end_date`에 유지된다.
- 지역 HTML collector 등 다른 source의 `raw_deadline` 의미는 변경하지 않았다.

## 수정 내용
- `map_work24_training_item()`에서 `traEndDate`를 `raw_deadline`으로 넘기지 않도록 제거했다.
- 고용24 `traEndDate`는 `end_date`와 `compare_meta.training_end_date`로만 보존한다.
- `admin._normalize_program_row()`는 별도 `deadline` 또는 `close_date`가 있는 경우만 `deadline`을 저장한다.
- 고용24 row에서 `deadline`과 `end_date`가 같으면 모집 마감일로 신뢰하지 않고 `deadline=None`으로 정규화한다.
- `scripts/program_backfill.py --work24-deadline-audit` dry-run 경로를 추가해 `source=고용24/work24` 이면서 `deadline=end_date`인 의심 row를 리포트한다.

## 테스트 결과
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_admin_router.py backend/tests/test_program_backfill.py`
  - 20 passed
- `backend\venv\Scripts\python.exe scripts/program_backfill.py --work24-deadline-audit --limit 5 --format json`
  - dry-run 정상 실행
  - 후보 5건 중 5건이 `deadline=end_date` 의심 row로 리포트됨

## 리스크 / 가능한 회귀
- 새로 수집되는 고용24 row는 별도 모집 마감일을 알 수 없는 경우 `deadline`이 비게 된다. 이는 부정확한 D-day를 막기 위한 의도된 변경이다.
- 기본 프로그램 목록이 DB `deadline` 필터를 사용하므로, 모집 마감일이 없는 고용24 row 노출 정책은 별도 제품 판단이 필요하다.
- 운영 DB에 이미 저장된 잘못된 `deadline` 값은 이번 작업에서 직접 수정하지 않았다.

## 추가 리팩토링 후보
- `--work24-deadline-audit` 결과를 바탕으로 운영 DB `deadline=NULL` backfill apply task를 별도 승인 후 실행한다.
- 고용24 상세 페이지에서 실제 신청 마감일을 안정적으로 파싱할 수 있는 selector가 확인되면 `close_date` 저장 경로를 추가한다.
- source별 날짜 의미(`deadline`, `close_date`, `start_date`, `end_date`)를 중앙 mapping table에 문서화하고 저장 전 검증 로그를 추가한다.
