# Supervisor Verification: TASK-2026-04-23-0556-address-field-and-region-matching

## Verification Summary

The profile address migration, profile API normalization, address edit UI, normalized profile display, and frontend type surface match the supervisor inspection handoff. The implementation remained mostly in the expected touched area and did not duplicate the existing profile address flow.

The backend region scoring work partially matches the handoff: explicit delivery method handling, online/hybrid scoring, adjacent region scoring, region-safe reason text, and address/no-address score breakdown weights are present in `backend/routers/programs.py`.

However, the program region source priority is not fully verified as implemented. `_compute_region_match()` passes `program.region`, `program.location`, `program.region_detail`, and `compare_meta` region/location/address into `_normalize_region_name()` together, and `_normalize_region_name()` concatenates all candidates before selecting the first alias by dictionary order. This can choose a lower-priority source when multiple sources contain conflicting regions, instead of enforcing the packet priority of `region` before display `location` before `compare_meta`.

## Checks Reviewed

- Re-ran: `python -m py_compile backend/routers/programs.py`
  - Result: passed.
- Re-ran: `python -m pytest backend/tests/test_programs_router.py`
  - Result: blocked by repository Python guard: Python 3.10.x required, current shell uses Python 3.13.2.
- Reviewed focused tests in `backend/tests/test_programs_router.py`.
  - Present coverage includes exact region match, adjacent region match, online scoring, hybrid scoring, explicit `teaching_method` precedence over fallback text, compare metadata region normalization, sparse profile fallback, and address/no-address breakdown expectations.
  - Missing coverage for conflicting region source priority, such as `program.region = "경기"` with `program.location = "서울 강남구"`.

## Result Report Consistency

The result report's changed-file list is consistent with the direct task implementation scope: `backend/routers/programs.py`, `backend/tests/test_programs_router.py`, `docs/refactoring-log.md`, and the task result report.

The result report accurately records that profile address migration/UI/API work already existed and was not reimplemented. It also accurately records that pytest was blocked by the Python 3.10 guard.

One result-report claim is overstated: it says program region source normalization keeps the required priority centered on `region`, display `location`, then compare metadata. The current code shape does not enforce that priority when sources conflict because all region source candidates are normalized as one combined text blob.

## Residual Risks

- Region source conflicts can produce incorrect matched region output and incorrect `score_breakdown.region` values.
- The focused backend test suite could not be executed in this shell, so verification relies on static inspection plus `py_compile`.
- Region and delivery classification remains keyword-based and may miss unusual provider wording.
- The worktree contains unrelated dirty changes from adjacent tasks, so final integration should still isolate this task's backend/test/report changes before commit.

## Final Verdict

- verdict: review-required

## Run Metadata

- generated_at: `2026-04-23T06:50:32`
- watcher_exit_code: `0`
- codex_tokens_used: `206,569`
