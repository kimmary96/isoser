# Supervisor Inspection: TASK-2026-04-16-1100-tier4-district-crawl

## Task Summary

- Task packet frontmatter is complete: `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present.
- `planned_against_commit` is `b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`, and current `HEAD` matches exactly.
- Optional `planned_files` and `planned_worktree_fingerprint` metadata are not present in the packet, so there was nothing additional to verify for those fields.
- Directly relevant implementation area inspected first: `backend/rag/collector/scheduler.py`, `backend/rag/collector/base_collector.py`, `backend/rag/collector/base_html_collector.py`, `backend/rag/collector/normalizer.py`, and `backend/rag/collector/tier3_collectors.py`.
- Current scheduler already includes Tier 3 collectors and supports `run_all_collectors(upsert=False)` dry-run behavior, which matches the packet assumptions.
- No significant drift was found in the touched backend collector area. Current unrelated worktree changes are concentrated outside the collector implementation area.

## Touched files

- Expected edit target: `backend/rag/collector/scheduler.py`
- Expected collector implementation target: `backend/rag/collector/tier3_collectors.py` or a new adjacent module such as `backend/rag/collector/tier4_collectors.py`
- Likely verification surface only: `backend/rag/collector/base_html_collector.py`
- Likely verification surface only: `backend/rag/collector/normalizer.py`
- Required later reporting targets after implementation: `reports/TASK-2026-04-16-1100-tier4-district-crawl-result.md`, `docs/current-state.md`, `docs/refactoring-log.md`

## Implementation outline

1. Keep the existing collector contract unchanged and implement six Tier 4 HTML collectors using the existing `BaseHtmlCollector` pattern.
2. Store Tier 4 source metadata per collector with `source_type="district_crawl"`, `collection_method="web_crawl"`, `scope="district"`, `region="서울"`, `tier=4`, and fixed `region_detail` per district.
3. Reuse current item shape conventions: `title`, `link`, `raw_deadline` where applicable, `category_hint`, optional `target`, `source_meta`, and `raw`.
4. Follow the current scheduler pattern by importing the new Tier 4 collectors and appending them to `COLLECTORS` without changing the tier-sorting behavior.
5. Keep failure isolation aligned with current scheduler behavior so a Tier 4 collector exception records failure and the batch continues.
6. Prefer a dedicated adjacent module for Tier 4 collectors if that keeps scheduler imports clear and avoids overgrowing `tier3_collectors.py`.

## Verification plan

- Run `run_all_collectors(upsert=False)` and confirm all six Tier 4 collectors appear in the source results.
- Confirm scheduler ordering remains tier-sorted and existing Tier 1 to Tier 3 sources still execute.
- For each new collector, verify at least one item is extracted in dry-run when the upstream page is reachable.
- Check normalized rows include `source_type="district_crawl"`, `tier=4`, `region="서울"`, and district-specific `region_detail`.
- Confirm HTTP-only handling for Guro and fixed `cntrId=CT00006` handling for Seongdong are implemented as packeted.
- Confirm zero-row and request-failure paths preserve current scheduler behavior and do not upsert partial failures when `upsert=False`.

## Preserved behaviors

- Preserve `BaseCollector` and `BaseHtmlCollector` interfaces and current `.collect()` return shape.
- Preserve scheduler deduplication, normalization flow, and `on_conflict: "title,source"` upsert behavior.
- Preserve current tier ordering logic in `scheduler.py` rather than introducing custom execution rules for Tier 4.
- Preserve fail-open batch behavior where one collector failure does not stop later collectors.
- Preserve existing Tier 1 to Tier 3 collector registrations and dry-run support.

## Risks

- Several new collectors rely on brittle HTML selectors or route constraints explicitly noted in the task packet, so structure drift at the source sites is the main risk.
- `normalizer.py` currently derives persisted fields from a narrow raw item contract, so any Tier 4-specific metadata must stay inside `raw` or existing supported fields unless normalization changes are intentionally scoped.
- Introducing six collectors in one packet increases the chance of uneven quality if selector patterns diverge; grouping them in one new module reduces scheduler churn but can create a large file quickly.
- Existing unrelated worktree changes in docs, frontend, watcher, and reports mean implementation should stay tightly scoped to backend collector files and required reports only.
