## Overall assessment

Not ready for promotion.

Frontmatter is complete, and the packet is close to executable, but it is not execution-ready against the current repository. The main issues are prerequisite readiness, stale file references in the save flows, moderate drift from the planned commit, and a few implementation/acceptance ambiguities that would force guesswork during execution.

## Findings

- Frontmatter completeness: pass. Required fields `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present.
- Repository path accuracy: partial pass. The core files named in the packet exist:
  - `frontend/app/api/dashboard/recommended-programs/route.ts`
  - `frontend/app/dashboard/page.tsx`
  - `frontend/lib/api/app.ts`
  - `frontend/lib/types/index.ts`
- Save-flow path accuracy: fail. The packet says to update `frontend/app/dashboard/activities/new/page.tsx`, but that file is only a redirect to `/dashboard/activities/__new__`. The actual activity save logic currently lives in `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`.
- Save-flow path accuracy: fail. The packet says "프로필 저장 성공 핸들러" without naming the real implementation file. The current profile save handlers live in `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`, not in the page component.
- Drift risk: moderate. `planned_against_commit` is `750fba4f766f86739e94368afa8474e2edbdc6b4`, while current `HEAD` is `c4a279ed70e2622f0c62377f9ed40fba6b62f0af`. The touched area has changed enough that the packet should be rebased before promotion, especially because the dashboard and save flows are no longer where the packet implies.
- Prerequisite readiness: fail. This packet depends on `TASK-2026-04-15-1710-recommend-api-enhance`, but that task is not present in `tasks/inbox/` and has no approval marker in `cowork/approvals/`. The existing review at `cowork/reviews/TASK-2026-04-15-1710-recommend-api-enhance-review.md` says it is not ready for promotion.
- Response-shape ambiguity: the packet says the BFF route should merge `program + _reason + _fit_keywords + _score` and return an `items` array, but the current frontend app contract is `{ programs: Program[] }` from `getRecommendedPrograms()`. The packet must state one response shape consistently.
- Score-field ambiguity: the current dashboard renders relevance from `program.final_score`. The packet introduces `_score` but does not say whether the card should render `_score`, `final_score`, or a fallback order. Acceptance criterion 6 says related도 must remain, but the mapping rule is missing.
- Filter-model ambiguity: the packet says "단일 필터만" in Non-goals, but the implementation notes introduce both `selectedCategory` and `selectedRegion` state and do not define which filter wins if a user selects one and then the other. The packet must specify whether selecting one clears the other.
- Acceptance clarity gap: criterion 5 says "활동 저장 후 대시보드로 돌아오면 추천 결과가 갱신됨", but the stated goal and implementation notes also require refresh after profile save. Acceptance should cover both, or the scope should be narrowed.
- Acceptance observability gap: criterion 5 does not define how a reviewer verifies that results were actually refreshed instead of merely re-rendered. The packet should specify an observable signal, such as `force_refresh=true` on invalidation and a subsequent dashboard fetch using fresh results.
- Edge-case mismatch: the packet says unauthenticated users can change filters and get latest-list filtering without login, but the current BFF route throws `"로그인이 필요합니다."` when no session access token exists. If guest filtering is in scope, the packet must explicitly define the required BFF/backend behavior. If not, remove that edge case.
- Missing reference: the packet hardcodes category values like `"IT"` and region values like `"서울"` without pointing to a canonical API enum or backend-normalized filter contract. Because the prerequisite API packet is not yet approved, these filter values are not stable enough to hardcode in an execution packet.

## Recommendation

Do not promote this packet yet.

Exactly what should change before promotion:

- Rebase the packet to the current repository state and update `planned_against_commit`.
- Resolve or promote the prerequisite `TASK-2026-04-15-1710-recommend-api-enhance` first.
- Replace the stale activity save reference with the actual file: `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`.
- Name the actual profile save file explicitly: `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`.
- Make the recommended-programs response contract consistent. Choose either:
  - BFF returns `{ programs: Program[] }` with merged recommendation metadata on each program, or
  - BFF returns `{ items: ... }` and update all downstream references accordingly.
- Define the relevance rendering rule explicitly, for example whether UI uses `_score ?? final_score`.
- Clarify the single-filter interaction rule so execution does not have to guess whether selecting category clears region or vice versa.
- Rewrite acceptance criterion 5 so it covers both profile-save and activity-save refresh behavior, with an observable verification method.
- Either remove the unauthenticated filtering edge case or add the exact BFF/backend behavior required to support it.
- Add a reference to the approved backend filter values once the prerequisite API packet is corrected.

With those changes, the packet looks promotable with minor-to-moderate edits. In its current form, it is not ready.

## Review Run Metadata

- generated_at: `2026-04-15T17:59:57`
- watcher_exit_code: `0`
- codex_tokens_used: `76,177`
