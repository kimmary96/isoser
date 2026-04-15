## Overall assessment

Not ready for promotion.

Frontmatter is complete, the referenced collector and normalizer paths exist, and drift in the directly touched area is limited. The packet is still not execution-ready because several task assumptions do not match the current repository contract.

## Findings

- Frontmatter completeness: OK. Required fields `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present.
- Repository path accuracy: mostly OK. `backend/rag/collector/hrd_collector.py`, `work24_collector.py`, `kstartup_collector.py`, `normalizer.py`, `scheduler.py`, `backend/.env.example`, and the frontend `/programs` page all exist.
- Drift risk: limited but real. Current `HEAD` is `750fba4f766f86739e94368afa8474e2edbdc6b4`, not `78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3`. The collector files themselves have not drifted materially, but the touched area has changed since planning, including the addition of `compare_meta` to the `programs` schema.
- Execution-flow mismatch: blocker. The packet requires `run_all_collectors(upsert=False)` and `run_all_collectors(upsert=True)`, but the current `backend/rag/collector/scheduler.py` exposes `run_all_collectors()` with no `upsert` parameter and always attempts Supabase upsert.
- Baseline mismatch: blocker. The packet says Phase 1 already removed hardcoded `is_ad` and `sponsor_name`, but the current `backend/rag/collector/normalizer.py` still returns `is_ad=False` and `sponsor_name=None`.
- Schema mismatch: blocker. The packet says to preserve the full source payload in `raw` JSONB, but the current `supabase/migrations/20260415_create_programs.sql` table definition has no `raw` column, and the normalizer does not persist it.
- Acceptance clarity issue: the packet names category targets as `AI·데이터`, `IT·개발`, `디자인`, `경영·마케팅`, `창업`, `기타`, but the current database constraint only accepts `AI`, `IT`, `디자인`, `경영`, `창업`, `기타`.
- Prerequisite ambiguity: blocker. The packet depends on `TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba`, but I found only the draft packet and review in `cowork/`, not a result report or completed task record proving that prerequisite is done.
- Missing references: the packet requires endpoint verification against official docs, but it does not provide the exact official HRD-Net, 고용24, and K-Startup references to use. That leaves avoidable ambiguity for execution.
- Acceptance wording is tighter than the current implementation. The packet requires a `"키 없음"` log, while `backend/rag/collector/base_api_collector.py` currently logs `is not configured.` when a key is absent.

## Recommendation

Do not promote yet.

These exact changes are needed before promotion:

- Reconcile the scheduler contract with the repo. Either change the packet to the current `run_all_collectors()` behavior, or explicitly make dry-run / `upsert` control part of the task scope.
- Resolve the Phase 1 dependency. Either provide evidence that `TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba` is complete, or move the remaining normalizer baseline work into this packet.
- Remove or scope the `raw` JSONB requirement unless the task also includes the required schema and persistence changes.
- Normalize the category acceptance language to the actual stored values allowed by the current `programs` schema.
- Add the exact official reference URLs, or point to a local reviewed document section with those URLs, for HRD-Net, 고용24, and K-Startup endpoint validation.
- Relax or align the missing-key logging criterion so it matches either the current implementation or an explicit logging change in scope.

## Review Run Metadata

- generated_at: `2026-04-15T15:53:33`
- watcher_exit_code: `0`
- codex_tokens_used: `61,708`
