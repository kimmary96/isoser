# Supervisor Inspection: TASK-2026-04-23-0555-program-card-redesign-with-relevance

## Task Summary

- Packet `tasks/running/TASK-2026-04-23-0555-program-card-redesign-with-relevance.md` has the required frontmatter fields: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
- `planned_against_commit` is `7609401e9dc6eca716ca6fc3ea313e03eea0a357`, and current `HEAD` is the same commit.
- No optional `planned_files` or `planned_worktree_fingerprint` metadata exists in the packet, so there is no packet-provided fingerprint to verify.
- Current worktree is not clean. Several directly relevant source files already contain uncommitted changes matching this task's direction, including relevance extension fields, a shared program card, and a dashboard bookmark BFF route.
- This is not classified as commit drift because the planned commit matches `HEAD`, but implementation must reconcile the existing in-flight worktree instead of starting from the clean planned commit assumption.

## Touched files

- `backend/routers/programs.py`
  - Current worktree already adds `relevance_reasons`, `score_breakdown`, `relevance_grade`, and `relevance_badge` to `ProgramRecommendItem` and `ProgramRelevanceItem`.
  - Current worktree contains helper functions for score percent, relevance grade/badge, compare score breakdown, and relevance reasons.
  - Current worktree also contains region matching changes and `/programs/batch`; those overlap with adjacent task concerns and should be reviewed carefully before further edits.
- `backend/rag/programs_rag.py`
  - No inspected diff for this task scope in the current worktree.
- `frontend/app/api/programs/compare-relevance/route.ts`
  - No inspected diff for this task scope; it continues forwarding backend compare relevance response through the BFF.
- `frontend/app/api/dashboard/recommended-programs/route.ts`
  - Current worktree maps recommendation response extension fields onto returned `Program` objects.
- `frontend/app/api/dashboard/bookmarks/[programId]/route.ts`
  - New untracked BFF mutation route exists and forwards `POST` / `DELETE` to backend `/bookmarks/{program_id}` with the session access token.
- `frontend/app/(landing)/programs/page.tsx`
  - Current worktree imports the new shared `ProgramCard`, filters displayable programs, passes preview cards to the recommendation section, and removes the old inline action-button card rendering.
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
  - Current worktree uses `ProgramCard`, filters recommendations below `0.4` / `40`, and renders a login CTA with blurred preview cards for non-login users.
- `frontend/app/(landing)/programs/program-card.tsx`
  - New untracked shared card component exists. It hides nonessential placeholders by conditional rendering, exposes relevance badge/percent/reasons, wraps body in a detail `Link`, and stops propagation for the star bookmark button.
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
  - Current worktree adds `recommended` as a sort option. This is outside the packet's explicit non-goals for adding sort options and should be reviewed before keeping.
- `frontend/lib/types/index.ts`
  - Current worktree adds relevance extension types and expands `ProgramSort` to include `recommended`.
- `frontend/lib/api/app.ts`
  - No inspected diff for this task scope.
- `frontend/lib/api/backend.ts`
  - Current worktree adds a `getPrograms()` helper for `/programs/batch`; this supports compare/list flows but is outside the core card/relevance task.

## Implementation outline

1. Treat the current worktree as an in-flight implementation, not a clean baseline.
2. Preserve existing response fields such as `relevance_score`, `matched_skills`, `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`, `region_match_score`, and `matched_regions`.
3. Review `backend/routers/programs.py` for scope boundaries:
   - Keep relevance extension fields and safe defaults for compare/recommend responses.
   - Avoid removing current region/address normalization fields because the packet explicitly says Task 2 owns region policy changes.
   - Confirm whether the current region weighting changes and `recommended` sort addition belong in this task or should be deferred.
4. Review `ProgramCard` before implementation continues:
   - Ensure list cards remove `상세 보기`, `비교에 추가`, and `지원 링크` buttons.
   - Ensure the star button uses the frontend BFF route and cannot trigger detail navigation.
   - Ensure missing title/deadline/source programs are filtered before rendering.
   - Ensure placeholder strings such as `프로그램 소개가 아직 등록되지 않았습니다`, `일정 추후 공지`, `지역 정보 없음`, and `태그 정보 없음` are not rendered on in-scope list cards.
5. Complete only minimal safe fixes after inspection. Do not rewrite the already-created card structure unless a concrete acceptance gap is found.

## Verification plan

- Backend:
  - Run targeted tests around `backend/routers/programs.py` if available, especially existing programs router tests.
  - Add or update focused tests only if current coverage does not assert compare relevance and recommendation extension fields.
  - Manually inspect `/programs/compare-relevance` and `/programs/recommend` response serialization paths for fallback/cache/default recommendation paths.
- Frontend:
  - Run TypeScript/lint checks for the frontend touched files.
  - Verify `/programs` renders only displayable cards and no old action buttons.
  - Verify unauthenticated recommendation section shows CTA preview, and authenticated recommendation section filters below 40%.
  - Verify star button calls `/api/dashboard/bookmarks/{programId}` and does not navigate to detail.
  - Verify card body click navigates to `/programs/{id}`.
- Regression:
  - Check compare page use of `compare-relevance` to ensure old fields still exist and new fields do not break consumers.
  - Check dashboard calendar recommendation cards are not unintentionally changed.

## Preserved behaviors

- Current `HEAD` matches the packet's planned commit.
- Existing compare relevance compatibility fields are intended to remain in place.
- Existing region fields and address-normalization-adjacent fields must be preserved for Task 2.
- Program list filtering, search, pagination, and existing backend list/count flows should remain intact.
- Dashboard calendar recommendation cards and program detail page cards are out of scope and should not be changed by this task.
- Bookmark mutation should remain authenticated and go through the frontend BFF route from browser code.

## Risks

- The worktree already contains uncommitted implementation changes in the task area. Implementer must not overwrite or reset them without explicit direction.
- `backend/routers/programs.py` currently includes region matching changes and score weighting that may belong to the follow-up address/region task rather than this packet.
- `recommended` sort was added in the current worktree, but the packet lists sorting option additions as a non-goal. This should be treated as a scope risk.
- Recommendation fallback/default/cache paths need careful checking so the new fields are always present or safely defaulted.
- `ProgramCard` currently initializes bookmark state locally as false, so existing bookmarked state display may be incomplete unless the calling data provides or later wiring adds that state.
- The BFF bookmark route converts all backend failures to `400` except missing session; this is acceptable for minimal implementation but may hide upstream status details.
