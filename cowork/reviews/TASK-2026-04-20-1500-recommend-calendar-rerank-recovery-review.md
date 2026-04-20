# Overall assessment

Ready for promotion.

The packet has all required frontmatter fields, points at the current `HEAD` (`b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`), and matches the current responsibility split in the codebase.

Current recommendation behavior is accurately grounded in the repository:

- scoring logic lives in `backend/rag/programs_rag.py`
- transport and cache I/O live in `backend/routers/programs.py`
- the existing dashboard BFF lives in `frontend/app/api/dashboard/recommended-programs/route.ts`
- the new calendar BFF is correctly specified as a new route under `frontend/app/api/dashboard/recommend-calendar/route.ts`

There is unrelated worktree noise in docs, watcher files, and landing/compare surfaces, but there are no current uncommitted edits in the main implementation area this packet plans to touch:

- `backend/rag/programs_rag.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`

That makes this packet promotable without additional drift correction.

# Findings

- `planned_against_commit` is current and no longer stale.
- The canonical backend path is now explicit and consistent: `GET /programs/recommend/calendar`.
- The canonical BFF path is now explicit and consistent: `GET /api/dashboard/recommend-calendar`.
- The packet correctly treats this work as `fix/update`, not a full greenfield implementation.
- The packet resolves the earlier docs-rule conflict by explicitly requiring updates to:
  - `docs/current-state.md`
  - `docs/refactoring-log.md`
- The packet constrains the work to additive API recovery without breaking the existing `POST /programs/recommend` contract.
- Anonymous-call behavior is testable enough for execution:
  - unauthenticated requests must still return 200
  - response shape stays the same
  - `relevance_score` must be returned consistently as `0` or another fixed fallback, not omitted

# Minor notes

- `frontend/lib/api/app.ts` is listed in `planned_files`, which is appropriate if the dashboard-side consumer helper is added there. If implementation ends up using only the route handler and a local hook in a follow-up UI task, that file may remain unchanged, but it is still a valid planned touchpoint.
- The packet intentionally leaves two implementation choices open:
  - whether expired programs are filtered out entirely or only demoted
  - exact `d_day_label` formatting

Those are acceptable execution-time decisions because the packet requires the chosen policy to be implemented and tested consistently.

# Recommendation

Promote as-is.

The packet is concrete, aligned to the current codebase, and narrow enough to execute safely before the calendar UI recovery task.

## Review Run Metadata

- generated_at: `2026-04-20T15:25:00+09:00`
- reviewer: `codex`
