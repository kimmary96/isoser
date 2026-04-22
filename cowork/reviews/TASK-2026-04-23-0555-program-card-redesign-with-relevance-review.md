# Overall assessment

Not ready for promotion yet.

The required frontmatter fields are present, and `planned_against_commit` matches current `HEAD` (`eb7a6d7e2828c76abf682fe0f478c538d3cd397e`). The packet does not include optional `planned_files` or `planned_worktree_fingerprint`, so there is no fingerprint metadata to verify.

The main referenced paths and behaviors exist: backend `POST /programs/recommend`, backend `POST /programs/compare-relevance`, frontend BFF `frontend/app/api/programs/compare-relevance/route.ts`, public `/programs` page, recommended programs section, compare UI, and bookmark backend routes.

# Findings

1. Drift risk: the packet says this task runs before address field work and must not use the address field, but the current worktree already contains uncommitted address/profile changes in `frontend/app/api/dashboard/profile/route.ts`, `frontend/lib/types/index.ts`, `docs/current-state.md`, and an untracked `supabase/migrations/20260423100000_add_address_to_profiles.sql`. This breaks the packet's "주소 필드 추가 전" assumption.

2. Score unit is ambiguous. The packet uses `40점`, `80점`, and weights summing to 100, while current compare relevance code returns normalized floats such as `0.4` / `0.7` thresholds and frontend recommendation display converts values `<= 1` into percentages. The packet must specify whether API fields store `0..1` or `0..100`, and whether filtering at 40 means `0.4` or `40`.

3. Card scope is too broad. Current relevant cards are at least `frontend/app/(landing)/programs/page.tsx`, `frontend/app/(landing)/programs/recommended-programs-section.tsx`, and `frontend/app/dashboard/page.tsx`. The packet says "목록 카드" and discusses personalized recommendations, but it does not explicitly define which cards must lose `상세 보기` / `비교에 추가` / `지원 링크`, which cards need star toggle, and whether dashboard calendar cards are in scope.

4. Bookmark implementation reference is incomplete. Backend bookmark create/delete routes exist in `backend/routers/bookmarks.py`, and frontend has `GET /api/dashboard/bookmarks`, but I did not find a frontend BFF mutation route for toggling bookmarks from `/programs` cards. The packet should state whether to add/extend frontend bookmark mutation routes or call an existing path.

5. Acceptance criteria need clearer API compatibility coverage. Current `ProgramRelevanceItem` already includes `fit_label`, `fit_summary`, `readiness_label`, and `gap_tags`; `ProgramRecommendItem` currently includes `score`, `relevance_score`, `reason`, `fit_keywords`, and `program`. The packet asks for new fields but should state how they coexist with the current v2 interpretation fields and whether default/cached recommendation paths must also populate them.

6. Required-field filtering is underspecified. The packet says cards missing title, deadline, or source must not render, but current public cards fallback to `제목 미정`, `출처 미상`, and date placeholders. It should define the exact backend/frontend field names used as required inputs, especially `deadline` vs `close_date` vs `end_date` and `source` vs `provider`.

# Recommendation

Do not promote until the packet is updated.

Before promotion, change the packet to:

1. Resolve the address-work sequencing drift: either isolate/commit/revert the current address work before this task runs, or update the packet to say address fields already exist in the worktree but region scoring remains out of scope and must stay weight `0`.
2. Define the relevance score unit and exact thresholds for API storage, response fields, sorting, and UI filtering.
3. List the exact frontend files/cards in scope and out of scope.
4. Specify the bookmark toggle API path to use or add.
5. Clarify coexistence with existing `fit_label`, `fit_summary`, `readiness_label`, and `gap_tags`, including cached/default `/programs/recommend` responses.
6. Define exact required fields for card eligibility and date/source fallback rules.

After those changes, the packet should be promotable with normal implementation risk.

## Review Run Metadata

- generated_at: `2026-04-23T05:58:44`
- watcher_exit_code: `0`
- codex_tokens_used: `98,915`
