# Result Report: TASK-2026-04-22-1800-program-source-field-mapping

## changed files

- `cowork/packets/TASK-2026-04-22-1800-program-source-field-mapping.md`
- `backend/rag/collector/work24_collector.py`
- `backend/rag/collector/kstartup_collector.py`
- `backend/rag/collector/program_field_mapping.py`
- `backend/rag/collector/normalizer.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `backend/tests/test_program_source_diff_cli.py`
- `scripts/program_source_diff.py`
- `cowork/packets/TASK-2026-04-22-1810-program-schema-backfill.md`
- `reports/TASK-2026-04-22-1810-program-schema-backfill-plan.md`

## why changes were made

- 고용24와 K-Startup API raw에는 기관명, 지역, 설명, 접수/훈련 일정, 전화번호, 원본 링크 같은 값이 있었지만, collector와 공통 normalizer 사이에서 대부분 사라지고 있었다.
- 상세 페이지와 비교 페이지는 `provider`, `location`, `description`, `start_date`, `end_date`, `source_url`을 이미 보고 있으므로, 기존 UI 계약을 바꾸기보다 수집/정규화 단계에서 해당 필드를 채우는 것이 가장 작은 수정이었다.

## preserved behaviors

- 기존 `title`, `deadline`, `link`, `target`, `source`, `source_type`, `collection_method`, `scope`, `region`, `region_detail` 저장 계약은 유지했다.
- 운영 DB에 없을 수 있는 `raw_data`, `support_type`, `teaching_method`, `is_certified` 컬럼은 scheduler payload에 직접 추가하지 않았다.
- 추적용 부가 필드는 이미 존재하는 `compare_meta` JSONB에 값이 있을 때만 담도록 했다.
- scheduler source 상태/skip/dry-run 계약은 유지했다.

## change summary

- 고용24 collector가 `address`, `subTitle`, `contents`, `traStartDate`, `traEndDate`, `courseMan`, `realMan`, `trprId`, `ncsCd`, `telNo`, `wkendSe`, 만족도/취업률/정원 관련 raw 값을 정규화 입력으로 넘기게 했다.
- K-Startup collector가 `pbanc_ctnt`, `pbanc_ntrp_nm`, `supt_regin`, `pbanc_rcpt_bgng_dt`, `pbanc_rcpt_end_dt`, `aply_mthd_*`, `prch_cnpl_no`, `supt_biz_clsfc`, 대상 상세 값을 정규화 입력으로 넘기게 했다.
- source별 필드 매핑을 `program_field_mapping.py`로 중앙화해 collector가 같은 매핑 함수를 재사용하도록 했다.
- 공통 normalizer가 source별 선택 필드(`hrd_id`, `location`, `provider`, `description`, `start_date`, `end_date`, `cost`, `subsidy_amount`, `source_url`, `compare_meta`)를 값이 있을 때만 보존하도록 했다.
- `scripts/program_source_diff.py`를 추가해 프로그램 UUID 기준으로 live raw 후보, normalized row, DB row, backend API row, UI 표시 스냅샷을 비교할 수 있게 했다.
- 운영 DB schema와 migration 차이를 확인했고, 누락 컬럼 backfill은 `TASK-2026-04-22-1810-program-schema-backfill`로 분리했다.

## before / after

- 변경 전: 고용24/K-Startup row는 주로 제목, 마감일, 링크, 대상만 저장되어 상세/비교 화면에서 기관/지역/소개가 비었다.
- 변경 후: 새로 수집되는 row는 기존 화면이 이미 참조하는 `provider`, `location`, `description`, `start_date`, `end_date`, `source_url`에 값을 받을 수 있다.
- 실제 API dry-run 기준:
  - 고용24: `서울 노원구`, `(주)KD아카데미`, 시작/종료일, 비용, 지원금, 원본 링크, NCS/전화/주말/정원 메타가 normalized row에 남았다.
  - K-Startup: `서울`, `서울소셜벤처허브`, 공고 설명, 접수 시작/마감, 신청 링크, 전화, 사업분류, 대상 상세 메타가 normalized row에 남았다.

## tests

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_work24_kstartup_field_mapping.py -q`
  - `2 passed`
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_scheduler_collectors.py -q`
  - `5 passed`
- `git diff --check -- backend/rag/collector/work24_collector.py backend/rag/collector/kstartup_collector.py backend/rag/collector/normalizer.py backend/tests/test_work24_kstartup_field_mapping.py cowork/packets/TASK-2026-04-22-1800-program-source-field-mapping.md`
  - 통과. 단, Windows line-ending 경고만 표시됨.
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_source_diff_cli.py -q`
  - `3 passed`

## risks / possible regressions

- 기존에 이미 DB에 저장된 고용24/K-Startup row는 자동으로 채워지지 않는다. 새 sync 또는 별도 backfill이 필요하다.
- 운영 DB 스키마가 migration 파일과 일부 다르게 보인다. `raw_data`, `support_type`, `teaching_method`, `is_certified`를 직접 쓰는 개선은 실제 DB 스키마 확인 후 별도 task로 처리해야 한다.
- 운영 DB schema check 결과 `raw_data`, `support_type`, `teaching_method`, `is_certified` 컬럼이 실제 운영 row에는 없었다.
- `compare_meta`는 화면 기본 표시에 아직 거의 쓰이지 않는다. 이번 변경은 추적성과 향후 비교 확장을 위한 보존 단계다.

## follow-up refactoring candidates

- 운영 DB에 `raw_data`, `support_type`, `teaching_method`, `is_certified` 컬럼을 추가하고 기존 row를 backfill하는 별도 task를 실행한다.
- 상세/비교 화면에서 `정보 없음`, `데이터 미수집`, `매핑 누락` 표시 기준을 source trace 기반으로 분리한다.
