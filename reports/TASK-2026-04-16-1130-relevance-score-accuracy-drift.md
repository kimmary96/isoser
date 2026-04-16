# TASK-2026-04-16-1130-relevance-score-accuracy Drift Report

## Summary

`planned_against_commit: 469cd3f` is materially out of date for the directly touched implementation area. The current worktree already contains substantial changes that overlap this task, so proceeding from the packet as written would risk duplicating or conflicting with existing work.

## Drift Findings

- Current `HEAD` is `9c25b1edf6392821c77aac60968a5bef6cb46ad5`, not `469cd3f`.
- `git diff --stat 469cd3f -- backend/rag/programs_rag.py backend/routers/programs.py frontend/app/api/dashboard/recommended-programs/route.ts frontend/app/(landing)/compare/programs-compare-client.tsx frontend/lib/types/index.ts` shows large drift across all core files named by the packet.
- `backend/rag/programs_rag.py` already includes:
  - `relevance_score` on `ProgramRecommendation`
  - separated `relevance_score` / `urgency_score` / `final_score`
  - `_profile_document()` with `name` and `portfolio_url` removed
  - expanded activity handling and adjusted fallback weighting
- `backend/routers/programs.py` already includes:
  - `ProgramRecommendItem.relevance_score`
  - `/programs/compare-relevance`
  - compare relevance response models and computation helpers
- `frontend/lib/types/index.ts` already includes `ProgramRelevanceItem` and compare response types.
- `frontend/app/(landing)/compare/programs-compare-client.tsx` no longer has the packet’s expected `"준비 중"` placeholder; it already renders relevance state, score bars, and matched skills.
- `supabase/migrations/20260416113000_add_relevance_score_to_recommendations.sql` already exists, so the migration requested by the packet appears to have been created.
- The packet references `cowork/packets/feat-compare-relevance-score.md`, but that file does not exist at the specified path in the current repository.
- The worktree is dirty in task-adjacent files, including `backend/tests/test_programs_router.py` and several task/report artifacts.

## Conclusion

Drift is significant. I stopped before modifying implementation files. The task packet should be refreshed against the current repository state before further work.
