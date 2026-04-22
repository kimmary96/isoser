# TASK-2026-04-16-1100-tier4-district-crawl Follow-up Result

## Changed files

- `backend/rag/collector/tier4_collectors.py`
- `backend/rag/collector/scheduler.py`
- `backend/tests/test_tier4_collectors.py`
- `backend/tests/test_scheduler_collectors.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- Tier 4 district crawler 운영 중 HTML 구조 변경, 일부 URL 0건, 요청 실패를 더 빨리 구분하기 위해 collector 진단 메시지를 보강했다.
- scheduler dry-run 결과에서 raw item 수와 dedupe 후 row 수가 함께 보이도록 해 수집 성공과 중복 제거를 구분할 수 있게 했다.

## Preserved behaviors

- Tier 4 collector의 수집 대상, selector, `.collect()` 반환 형식은 유지했다.
- 기존 Tier 1~4 scheduler 정렬, 실패 격리, Supabase upsert 계약은 변경하지 않았다.
- `run_all_collectors(upsert=False)`는 계속 DB 저장 없이 dry-run 결과만 반환한다.

## Verification

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_tier4_collectors.py backend/tests/test_scheduler_collectors.py -q`
  - `13 passed, 6 warnings`
- Tier 4 collector 6종 live check
  - `DobongStartupCollector`: 33 raw items / 33 normalized rows
  - `GuroCollector`: 4 raw items / 4 normalized rows
  - `SeongdongCollector`: 7 raw items / 7 normalized rows, notice URL parse-empty 1건
  - `NowonCollector`: 10 raw items / 10 normalized rows
  - `DobongCollector`: 1 raw item / 1 normalized row, notice URL parse-empty 1건
  - `MapoCollector`: 6 raw items / 6 normalized rows
- Tier 4-only scheduler dry-run
  - `failed_count=0`
  - 6개 source 모두 `status=dry_run`
  - dry-run message에 `raw_items`, `deduped_rows`, `collector_message` 포함 확인

## Risks / possible regressions

- 외부 HTML 구조 의존성은 그대로 남아 있어 selector 변경 시 수집량이 급감할 수 있다.
- dry-run message 문자열이 더 길어져, 이 문자열을 정확히 비교하는 외부 운영 스크립트가 있으면 조정이 필요할 수 있다.

## Follow-up refactoring candidates

- `DistrictHtmlCollector`의 진단 메시지 구성을 별도 helper로 분리하면 향후 Tier 5 또는 다른 HTML collector에도 재사용할 수 있다.
- 성동 notice URL과 도봉구청 notice URL의 parse-empty가 정상적인 일시 상태인지, selector drift인지 주기적으로 재확인하는 lightweight smoke를 추가할 수 있다.
