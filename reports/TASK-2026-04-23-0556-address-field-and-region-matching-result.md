# TASK-2026-04-23-0556-address-field-and-region-matching Result

## Summary

Supervisor inspection handoff was treated as the approved implementation scope. The existing profile address migration, profile API normalization, profile edit UI, normalized profile display, and frontend types were already present, so this step did not duplicate them. The remaining implementation work was limited to backend region matching and focused tests.

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-23-0556-address-field-and-region-matching-result.md`

## Why changes were made

- `backend/routers/programs.py` now evaluates explicit `teaching_method` / equivalent compare metadata before free-text fallback for online/hybrid region scoring.
- Online plus offline wording, or online plus a real Korean region name in fallback text, is classified as hybrid and receives the 10/15 region contribution.
- Program region source normalization now keeps the required priority centered on `region`, display `location`, then compare metadata `region` / `location` / `address`, with the existing `region_detail` fallback preserved for compatibility.
- `score_breakdown` now switches weights by profile address availability:
  - with region/address: target job 30, skills 25, experience 15, region 15, readiness 10, behavior 5
  - without region/address: target job 35, skills 30, experience 20, region 0, readiness 10, behavior 5

## Preserved behaviors

- Existing profile address migration was not modified.
- Existing nullable profile address fields and older DB fallback behavior remain unchanged.
- Existing `@supabase/ssr` profile route session flow was not touched.
- Existing region reasons continue to use normalized labels such as `서울`, `경기`, `온라인`, or `혼합`; raw address, district, road name, and lot-level details are not added to relevance reasons.
- Existing relevance score blending behavior is preserved: profile region/address present blends base relevance with region score, while no-address profiles keep the base relevance score.

## Verification

- Passed: `python -m py_compile backend/routers/programs.py`
- Blocked: `python -m pytest backend/tests/test_programs_router.py`
  - Reason: repository Python guard requires Python 3.10.x, but the available `python` is 3.13.2.
- Blocked: direct helper smoke import
  - Reason: local Python environment is missing backend runtime dependency `bs4`.

## Risks / possible regressions

- Pytest was not runnable in this shell because the required Python 3.10 runtime is unavailable.
- Delivery-method classification remains conservative and keyword-based, so unusual provider wording can still be missed.
- Existing relevance score blending still depends on the upstream RAG score as the non-region base; this was intentionally preserved to avoid broad scoring rewrites.

## Follow-up refactoring candidates

- Extract shared Korean region normalization into a backend utility so profile, compare relevance, and listing filters use one dictionary.
- Add a small pure unit-test surface for delivery-method classification that can run without importing collector dependencies.
- Consider storing normalized program region/delivery fields during ingestion to reduce runtime keyword heuristics.
