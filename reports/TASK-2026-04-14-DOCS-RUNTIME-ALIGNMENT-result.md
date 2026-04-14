# TASK-2026-04-14-DOCS-RUNTIME-ALIGNMENT result

## changed files
- `README.md`
- `CLAUDE.md`

## why changes were made
- `README.md` described guest mode as an active current capability even though the current codebase no longer has `frontend/lib/guest.ts`.
- `CLAUDE.md` described the backend as Python 3.11 and recommended `backend/venv`, which conflicted with the enforced runtime in `backend/check_python_version.py` and the current README guidance.
- The task required aligning only the top-level documentation wording for runtime, auth state, and backend virtual environment path.

## preserved behaviors
- No application code, config, or runtime behavior was changed.
- Existing README and CLAUDE structure was preserved.
- Backend runtime guidance remains Python 3.10-based, matching the current runtime guard.

## risks / possible regressions
- Low risk. The change is documentation-only.
- `CLAUDE.md` still contains broader historical and roadmap context outside this task's scope; other stale wording may remain elsewhere.

## follow-up refactoring candidates
- Audit other project docs for stale guest-mode or v1/v2 historical wording when a broader documentation cleanup task is scheduled.

## checks run
- Confirmed `planned_against_commit` matches `HEAD` (`3a8be4218476bd3511543759c55409ecca497621`).
- Confirmed backend runtime guard in `backend/check_python_version.py` enforces Python 3.10.
- Confirmed `frontend/lib/guest.ts` is absent.
- Verified touched doc strings with targeted `rg` searches and `git diff`.
