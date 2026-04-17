# TASK-2026-04-16-1100-tier4-district-crawl Result

## changed files
- `backend/rag/collector/tier4_collectors.py`
- `backend/rag/collector/scheduler.py`
- `backend/tests/test_tier4_collectors.py`
- `backend/tests/test_scheduler_collectors.py`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-16-1100-tier4-district-crawl-result.md`

## why changes were made
- Verified the task packet first against the current repository state.
- Confirmed `planned_against_commit` matches current `HEAD` `ddc1083bf1a82c4ed21ccd313e32106227d663b8`.
- Recomputed the optional planned-file fingerprint with `scripts/compute_task_fingerprint.py` and confirmed it still matches `a282bf99d4f7c6b8f288bd66348677603e118c3ddeb392330ddddd090f3ad2ae`.
- Confirmed the planned touch set was clean before editing:
  - `backend/rag/collector/scheduler.py`
  - `backend/rag/collector/tier3_collectors.py`
  - `backend/rag/collector/tier4_collectors.py`
  - `backend/tests/test_scheduler_collectors.py`
  - `backend/tests/test_tier4_collectors.py`
- Added `backend/rag/collector/tier4_collectors.py` with 6 new Tier 4 district collectors:
  - `DobongStartupCollector`
  - `GuroCollector`
  - `SeongdongCollector`
  - `NowonCollector`
  - `DobongCollector`
  - `MapoCollector`
- Registered the Tier 4 collectors in `backend/rag/collector/scheduler.py` without changing the existing tier-based ordering rule.
- Added parser fixture tests for all 6 Tier 4 collectors and a scheduler dry-run order test that confirms Tier 4 appears after Tier 3.
- Updated one existing Tier 3 scheduler expectation to match the scheduler’s actual stable-within-tier ordering behavior.

## preserved behaviors
- Existing Tier 1 to Tier 3 collector implementations and scheduler failure isolation remain intact.
- Scheduler still sorts by `tier` and keeps the original in-list order within the same tier.
- `normalize()` and Supabase upsert flow were not changed.
- Existing `title,source` conflict handling and dry-run path remain unchanged.
- Tier 4 collectors stay HTML/parser based and reuse the existing `BaseHtmlCollector` pattern.

## risks / possible regressions
- Tier 4 parsers are fixture-driven heuristics against current expected URL/query patterns. If live markup changes, individual source parsing may degrade to empty results without breaking the batch.
- `DobongCollector` uses title keyword filtering to avoid general district notices. That may under-collect if relevant postings use unexpected wording.
- `MapoCollector` intentionally parses only main-page sections, so detail-only notices will still be missed by design.
- Live verification was attempted only through scheduler dry-run, and live collection itself could not be validated successfully in this environment because outbound requests were refused with `WinError 10061`.
- The scheduler dry-run therefore verified registration and source-level failure isolation, but not real remote HTML content.

## follow-up refactoring candidates
- Split common district query-string extraction helpers out of `tier4_collectors.py` if more district sources are added.
- Add source-specific HTML snapshot fixtures if these district pages start changing frequently.
- Consider emitting source-specific empty/parsing messages from some Tier 2 collectors too, so all HTML collectors report failures with the same granularity as Tier 3 and Tier 4.

## verification
- Passed: `backend\venv\Scripts\python.exe -m pytest backend\tests\test_tier4_collectors.py backend\tests\test_scheduler_collectors.py -q`
  - Result: `11 passed`
- Ran: `backend\venv\Scripts\python.exe -c "from backend.rag.collector.scheduler import run_all_collectors; import json; print(json.dumps(run_all_collectors(upsert=False), ensure_ascii=False)[:2000])"`
  - Result: scheduler included Tier 4 sources in dry-run output and continued across source-level failures.
  - Limitation: live HTTP requests were refused in the local environment, so district sources reported `request_failed` rather than validated live payload parsing.

## Run Metadata

- generated_at: `2026-04-17T13:05:21`
- watcher_exit_code: `0`
- codex_tokens_used: `191,400`

## Git Automation

- status: `pushed`
- branch: `develop`
- commit: `2b1d52c4401caf41e15d168069a8c623e0e4036c`
- note: [codex] TASK-2026-04-16-1100-tier4-district-crawl 구현 완료. Pushed to origin/develop. Automatic main promotion skipped because origin/main is not an ancestor of the task commit.
