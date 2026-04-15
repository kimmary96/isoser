## Overall assessment

Not ready for promotion.

Frontmatter is complete, the referenced implementation paths mostly exist, and the packet is close to executable. However, it currently depends on an unresolved prerequisite, has moderate drift against the current repository, and leaves several execution-critical behaviors underspecified. This is not promotable with wording-only edits; a few concrete packet changes are required first.

## Findings

- Frontmatter completeness: pass. Required fields `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present.
- Repository path accuracy: pass with minor caveats. The packet’s three target files exist:
  - `backend/routers/programs.py`
  - `backend/rag/programs_rag.py`
  - `backend/rag/chroma_client.py`
- Drift risk: moderate. `planned_against_commit` is `750fba4f766f86739e94368afa8474e2edbdc6b4`, while current `HEAD` is `c4a279ed70e2622f0c62377f9ed40fba6b62f0af`. The touched area has changed since planning, especially `backend/routers/programs.py`, which already gained new list/count filtering behavior after the packet baseline. The drift is not obviously fatal, but the packet should be rebased before promotion.
- Prerequisite readiness: fail. This packet explicitly depends on `TASK-2026-04-15-1700-recommend-data-pipeline`, but that prerequisite is not promoted in `tasks/inbox/`, has no approval marker in `cowork/approvals/`, and its existing review says it is not ready for promotion. This packet should not be promoted until that dependency is resolved or the dependency statement is rewritten.
- Acceptance ambiguity: criterion 2 says region-filtered results should be "서울 지역 우선 추천됨", but the implementation notes describe hard filtering via Chroma metadata and filtered program fetches, not prioritization. The packet must choose one behavior:
  - strict filter, or
  - soft boost/prioritization
- Acceptance ambiguity: criterion 3 uses "응답 속도가 현저히 빠름" as proof of cache use. That is not execution-grade acceptance. It needs a deterministic observable, such as response metadata, log event, or a cache-hit code path that can be asserted.
- Acceptance gap: the packet says cache is used only when `force_refresh` is false and no filters are provided, but the user flow says `POST /programs/recommend` may include `category`, `region`, `force_refresh`, and "캐시가 있으면 `recommendations` 테이블에서 즉시 반환". Those two statements conflict. The packet needs to state exactly when cache lookup is allowed and when it is intentionally bypassed.
- Missing reference: the packet depends on a `recommendations` table, but the current repo migration `supabase/migrations/20260415_create_recommendations.sql` only creates the table. It does not define any RLS policies. If the intended runtime behavior depends on policy shape or migration application state, the packet needs to name that explicitly instead of assuming the table is fully operational.
- Implementation ambiguity: `_load_cached_recommendations(user_id)` keys cache only by `user_id`, while the packet also introduces `top_k`, `category`, `region`, and `force_refresh`. That is acceptable only if the packet explicitly restricts caching to the default unfiltered path. Right now that rule is implied in one section and contradicted in another.
- Data-shape ambiguity: `_save_recommendations` stores `similarity_score` from `item.score`, but `item.score` in current code is the already mixed final score returned from `ProgramsRAG.recommend()`. The packet separately stores `urgency_score` and `final_score`, so the meaning of `similarity_score` is currently wrong or at least ambiguous.
- Current code contract drift: `docs/specs/api-contract.md` still documents `POST /programs/recommend` body as only `{ "top_k": 9 }`. Since this packet changes request shape, it should either require updating that contract doc or explicitly note that the implementation task must update API docs if promoted.
- Missing direct reference for fallback behavior: the packet requires Chroma `where=None` fallback when a filtered search fails on an empty collection, but it does not identify how to distinguish:
  - empty collection,
  - invalid filter,
  - zero-match filtered query
  in the current `ChromaManager.search()` implementation, which currently swallows exceptions and returns `[]`.

## Recommendation

Do not promote this packet yet.

Before promotion, make these exact changes:

- Rebase the packet to current `HEAD` and refresh `planned_against_commit`.
- Resolve the prerequisite dependency first. Either:
  - promote a corrected `TASK-2026-04-15-1700-recommend-data-pipeline`, or
  - remove/replace the dependency if this packet can stand on existing repo state alone.
- Rewrite the cache rules so they are unambiguous:
  - whether filtered requests ever read cache
  - whether filtered requests ever write cache
  - whether `top_k` affects cache eligibility
- Rewrite acceptance criterion 2 to say either "서울 지역만 추천" or "서울 지역을 가중치로 우선 추천". The current packet mixes both models.
- Replace acceptance criterion 3 with a deterministic cache-hit signal instead of "noticeably faster".
- Clarify the stored score fields so `similarity_score`, `urgency_score`, and `final_score` map cleanly to actual runtime values.
- Add the missing schema/runtime reference for the `recommendations` table state if this task assumes more than simple table existence.
- Add a note that the API contract doc must be updated if the request body changes are implemented.

After those changes, this packet looks promotable with minor-to-moderate edits. In its current form, it is not execution-ready.

## Review Run Metadata

- generated_at: `2026-04-15T17:58:15`
- watcher_exit_code: `0`
- codex_tokens_used: `73,153`
