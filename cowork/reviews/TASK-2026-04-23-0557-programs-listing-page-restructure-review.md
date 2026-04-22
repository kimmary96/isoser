# Overall assessment

Not ready for promotion yet.

Required frontmatter is complete: `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present. `planned_against_commit` exists and matches current `HEAD` (`eb7a6d7e2828c76abf682fe0f478c538d3cd397e`). The packet has no optional `planned_files` or `planned_worktree_fingerprint`, so there is no planned metadata to verify.

The main repository paths are accurate: `/programs` is implemented in `frontend/app/(landing)/programs/page.tsx`, filter UI is in `programs-filter-bar.tsx`, and a recommended section already exists in `recommended-programs-section.tsx`. Drift from committed code is low for the `/programs` route itself, but the current worktree is dirty in `frontend/lib/types/index.ts` and docs due to profile address work, which can collide with this task's expected `ProgramSort` and `Program` type edits.

# Findings

1. Section/filter scope is ambiguous. The packet says users can use search, filters, sort, recruiting toggle, and pagination, but it does not state whether those controls apply to all three sections or only `전체 프로그램`. This affects counts, empty states, URL query behavior, and whether `맞춤 추천` / `마감 임박` must be fetched independently from the paginated full list.

2. Sort contract is underspecified. Current frontend `ProgramSort` and backend `PROGRAM_SORT_OPTIONS` only support `deadline` and `latest`. The packet requires `맞춤 추천순`, `마감 임박순`, and `최신순`, but does not define exact query values, backend/frontend ownership, fallback for logged-out users, or behavior when relevance data is absent.

3. New filter data sources are not execution-ready. Current list API supports category, region, teaching method, cost, participation time, recruiting, recent closed, and sort. It does not expose explicit query params for 선발 절차, 채용 연계, 운영 기관, or 추천 대상. The packet should map each filter to exact fields such as top-level `provider`, `compare_meta.target_group`, `compare_meta.employment_rate_6m`, or another source, and say which filters are backend-supported versus deferred.

4. Task 1 integration reference is unstable. This packet depends on Task 1's card component and `relevance_score`, `relevance_reasons`, `relevance_badge` policy, but Task 1's review currently says that packet is not ready. Current code has `relevance_score`, `_reason`, `fit_label`, `fit_summary`, `readiness_label`, and `gap_tags`, but no confirmed `relevance_reasons` or `relevance_badge` contract.

5. Required-field exclusion needs exact rules. Acceptance says programs missing title, deadline, or source must not appear in any section, while current cards intentionally fall back to `제목 미정`, `출처 미상`, and missing-date placeholders. The packet must define whether `deadline` means normalized `deadline` after `close_date` resolution, and whether `source`, `provider`, or source URL is the required source field.

6. Login CTA and query preservation need a concrete route. The packet says CTA goes to login and filtering should be preserved after login when possible, but it does not specify whether to use `/login?redirectedFrom=...`, whether the current `/programs` query string must be encoded, or whether this applies only to the CTA.

7. Existing implementation is partial and should be acknowledged in scope. `/programs` already has a `RecommendedProgramsSection`, but logged-out users currently see a dark CTA band, not three blurred public cards with overlay. The packet should classify this as an update to existing implementation, not a new section build.

# Recommendation

Do not promote until the packet is revised.

Before promotion, update the packet to define:

- Whether global filters and sorting affect all three sections or only `전체 프로그램`.
- Exact sort query values and backend/frontend handling for recommended sorting.
- Exact field/query mappings for 선발 절차, 채용 연계, 운영 기관, and 추천 대상, including which ones are deferred if data is unavailable.
- The Task 1 dependency state, or remove unstable `relevance_reasons` / `relevance_badge` references until that contract is approved.
- Exact required-field eligibility rules for title, deadline, and source.
- The login CTA URL and redirect/query preservation behavior.
- That the existing `RecommendedProgramsSection` is reused and modified.

After those changes, the packet should be promotable with moderate implementation risk.

## Review Run Metadata

- generated_at: `2026-04-23T06:02:07`
- watcher_exit_code: `0`
- codex_tokens_used: `113,164`
