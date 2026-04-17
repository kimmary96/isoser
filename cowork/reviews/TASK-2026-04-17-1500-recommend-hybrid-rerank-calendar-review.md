# Overall assessment

Not ready for promotion yet.

The packet has all required frontmatter fields, and the relevant code area has low drift versus `planned_against_commit: 5206453` even though current `HEAD` is `553c76323e57e4d381aca11cb599da74691f36bf`. The recommendation-related files appear unchanged since `5206453`, and there is no optional `planned_files` or `planned_worktree_fingerprint` metadata to verify. However, the packet still contains a few blocking ambiguities and one repo-rule conflict that should be fixed before execution.

# Findings

- `planned_against_commit` is stale. The packet itself already says to replace it before execution, and it should be updated to current `HEAD` before promotion.

- The packet points at the wrong primary implementation location. It says the effective scoring problem lives in `backend/routers/programs.py`, but the current weight logic and `urgency_score` calculation are implemented in `backend/rag/programs_rag.py`. `backend/routers/programs.py` mainly handles transport and cache persistence. The packet should name both files clearly so the executor does not patch the wrong layer first.

- The FastAPI endpoint path is ambiguous against the current router structure. The packet requires `GET /recommend/calendar`, but the existing program router is mounted under `/programs` and there is no `/recommend` router in `backend/main.py`. The packet should explicitly choose one canonical backend path and match that choice in acceptance criteria and transport notes.

- The BFF path is also only described, not grounded in current files. The packet says the dashboard will call `GET /api/dashboard/recommend-calendar`, but that route does not exist today. Current BFF coverage only includes `frontend/app/api/dashboard/recommended-programs/route.ts`. The packet should explicitly call out the new BFF route file and whether `frontend/lib/api/app.ts` also needs a new client helper.

- The packet narrative is partly outdated about current behavior. The current code already computes `urgency_score` in `backend/rag/programs_rag.py`, but with a linear 30-day decay and `0.8 / 0.2` weighting, not the packet’s target `0.6 / 0.4`. That is acceptable drift for a new task, but the packet should describe the real baseline accurately.

- There is a documentation-rule conflict. The packet says `docs/` are read-only and specifically says `docs/specs/api-contract.md` should be proposal-only, but repository rules in `AGENTS.md` require updating `docs/current-state.md` and `docs/refactoring-log.md` after behavior changes. The packet should state whether this task is exempt from those AGENTS.md reporting steps or whether those two docs are still required while `docs/specs/api-contract.md` remains proposal-only.

- Acceptance for the anonymous path is not fully operationalized. It says unauthenticated results should be sorted by `urgency_score` only, but it does not specify whether `relevance_score` must be returned as `0`, `null`, or omitted for anonymous calls. That should be fixed so API behavior is testable and type-safe.

- Acceptance for expired cached rows is directionally good but incomplete. The packet says expired or stale cached rows should be filtered, but it does not specify whether stale cached scores inside TTL should trigger recomputation or only response-time filtering. That decision affects implementation shape and test expectations.

- Path accuracy check passed for the packet workflow itself. `cowork/packets/`, `tasks/inbox/`, and `tasks/remote/` all exist, so the transport notes are structurally valid.

- Current worktree noise is low for the touched area. There are uncommitted changes in docs and watcher-related files, but no current worktree edits in the main recommendation implementation files under `backend/`, `frontend/`, or `supabase/` for this task surface.

# Recommendation

Do not promote yet.

Before promotion, update the packet to:

1. Set `planned_against_commit` to current `HEAD` (`553c76323e57e4d381aca11cb599da74691f36bf` or its intended short SHA).
2. Correct the implementation references to reflect current responsibility split:
   `backend/rag/programs_rag.py` for scoring and ranking,
   `backend/routers/programs.py` for endpoints and cache I/O.
3. Choose and state one exact backend calendar endpoint path that matches the current router design.
4. Explicitly name the new BFF route and any required client/type touchpoints.
5. Resolve the docs-update rule conflict so the executor knows exactly which docs are editable, required, or proposal-only.
6. Tighten the anonymous-response and stale-cache acceptance details so they are testable.

After those edits, this packet looks promotable with minor changes rather than a full rewrite.

## Review Run Metadata

- generated_at: `2026-04-17T12:25:21`
- watcher_exit_code: `0`
- codex_tokens_used: `87,967`
