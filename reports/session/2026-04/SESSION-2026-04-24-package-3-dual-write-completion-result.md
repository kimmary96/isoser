# SESSION-2026-04-24 package 3 dual write completion

## 변경 파일
- `backend/services/program_dual_write.py`
- `backend/routers/admin.py`
- `backend/rag/collector/scheduler.py`
- `backend/tests/test_admin_router.py`
- `backend/tests/test_scheduler_collectors.py`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 패키지 3의 남은 핵심 공백은 `profile/resume/activity` refresh bridge 이후에도 남아 있던 프로그램 적재 dual write였다.
- `admin`과 `collector`가 서로 다른 규칙으로 저장되면 이후 패키지 4 read switch에서 데이터 drift가 커지므로, 같은 helper를 쓰는 공통 seed 상태로 먼저 맞췄다.

## 변경 내용
- `backend/services/program_dual_write.py`를 추가해 additive canonical `programs` 컬럼과 provenance `program_source_records` row를 만드는 공통 helper를 모았다.
- `backend/routers/admin.py`는 기존 `programs` upsert 동작을 유지하면서, normalize 단계에서 canonical additive 필드를 함께 싣고 upsert 후 `program_source_records` best-effort mirror를 계속 수행하도록 정리했다.
- `backend/rag/collector/scheduler.py`도 같은 helper로 payload를 보강한 뒤 Supabase upsert를 수행하고, 성공한 batch마다 `program_source_records` best-effort mirror를 시도하도록 바꿨다.
- collector 경로는 새 additive 컬럼이 없는 스키마에서도 unknown column만 제거하며 계속 저장하고, `program_source_records` 테이블이나 conflict index가 없으면 provenance write만 건너뛰도록 soft-fail 처리했다.
- roadmap와 current-state를 실제 저장소 기준으로 올려, 패키지 3은 저장소 seed 기준 완료, 다음 현재 패키지는 패키지 4로 재판정했다.

## 유지한 동작
- 기존 `programs` upsert 성공/실패 기준은 넓히지 않았다.
- `program_source_records`가 없어도 admin sync와 collector 저장은 계속 동작한다.
- 기존 Chroma sync, dry-run quality 보고, 수집 source별 상태 리포트 흐름은 유지했다.

## 리스크 / 가능한 회귀
- 패키지 3은 저장소 seed 기준으로 닫혔지만, 운영 DB에 migration apply/backfill/validation을 실제로 돌린 것은 아니다.
- collector는 provenance write를 best-effort로만 시도하므로, 운영 DB 인덱스/테이블 구성이 예상과 다르면 새 row 적재율은 낮을 수 있다.
- `primary_source_record_id`까지 즉시 연결하는 write는 아직 별도 seed를 두지 않았으므로, read switch 단계에서는 `program_id + is_primary` fallback도 함께 고려해야 한다.

## 검증
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_admin_router.py backend\tests\test_scheduler_collectors.py -q`
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\admin.py backend\rag\collector\scheduler.py backend\services\program_dual_write.py`

## 후속 리팩토링 후보
- 패키지 4: bookmarks/calendar direct `programs` read를 `program_list_index` summary read로 전환
- 패키지 4: backend recommendation/compare read를 `user_recommendation_profile` 우선 구조로 전환
- 패키지 4: 상세 read를 `programs + program_source_records` 조합으로 옮기고 `primary_source_record_id` 의존을 축소하거나 보강
