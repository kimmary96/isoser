## Overall assessment

Not ready for promotion yet.

Frontmatter is complete for required fields, and `planned_against_commit` matches current `HEAD` (`b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`), so there is no commit-level drift. The packet is directionally correct and close to promotable, but it still leaves a few implementation-defining decisions unresolved against the current repository.

## Findings

- Frontmatter completeness: pass.
  - Required fields from `AGENTS.md` are present: `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`.
  - Optional `planned_files` and `planned_worktree_fingerprint` are not present, so there was nothing to verify for worktree fingerprint matching.

- Repository path accuracy: mostly pass.
  - Current public route is `/compare`, and `frontend/middleware.ts` redirects legacy `/programs/compare` to `/compare`.
  - The packet correctly names `frontend/app/(landing)/compare/page.tsx` and `frontend/app/(landing)/compare/programs-compare-client.tsx` as the main compare route files.
  - The backend still returns `select="*"` from `backend/routers/programs.py`, so the packet’s assumption about raw `programs` rows is accurate.

- Direct drift risk: low at commit level, but nontrivial at worktree level.
  - `git status --short` shows an already-dirty worktree, including `frontend/app/(landing)/compare/program-select-modal.tsx`.
  - The packet does not include `planned_files`, so it cannot lock execution to the intended touched area under the current dirty state.

- Missing relevant file reference: `frontend/app/(landing)/compare/program-select-modal.tsx`.
  - That modal still renders `program.compare_meta?.subsidy_rate`.
  - If the intended UX is “compare surfaces should no longer depend on `compare_meta` by default”, the packet should either include this file in scope or explicitly exclude it.
  - As written, the packet’s compare-card/tag simplification can be implemented in `programs-compare-client.tsx` while leaving another compare entry surface inconsistent.

- Acceptance clarity gap: `is_certified` semantics are not fixed.
  - The revised model says `false -> 미인증`, but the packet’s own edge case says the implementer should first verify whether some sources default `false` vs truly unknown.
  - That is an unresolved behavior contract, not an implementation note.
  - The packet should decide one of these before promotion:
    - treat stored `false` as authoritative `미인증`
    - or treat source-specific `false` as potentially unknown and define a stricter display rule

- Acceptance clarity gap: fallback policy is still partly underspecified for real fields.
  - The packet distinguishes `"정보 없음"` vs `"데이터 미수집"` well at a high level.
  - But it does not fully pin down which exact fields must always use `"데이터 미수집"` when blank versus which may still use `"정보 없음"` in implementation.
  - The strongest ambiguity is around `summary`/`description`, `provider`, `location`, `category`, and `application_url` fallback summaries, because these are now core table rows but the packet only partly defines field-by-field copy behavior.

- Existing docs/history conflict is manageable but should be acknowledged in the packet.
  - `docs/current-state.md` and the prior completed task still describe compare as `compare_meta`-driven.
  - That is not a blocker for implementation, but this packet is intentionally reversing that UI dependency, so the promotion-ready packet should explicitly say this task supersedes the earlier compare display assumptions.

## Recommendation

Do not promote yet.

Before promotion, update the packet to make these changes:

- Add `frontend/app/(landing)/compare/program-select-modal.tsx` to the relevant implementation surface, or explicitly state that modal tags are out of scope and may remain `compare_meta`-based for now.
- Resolve the `is_certified` contract in the packet itself. Do not leave “verify first” as an execution-time decision.
- Tighten the fallback-copy contract by field, especially for `provider`, `location`, `category`, `summary`, `description`, and the support-link row/CTA summary.
- Add optional `planned_files` and `planned_worktree_fingerprint` because the current worktree is dirty and this task depends on a narrow compare-area touch set.
- Add one explicit note that this task supersedes the earlier `/compare` UI assumption that `compare_meta` is the primary comparison source.

After those edits, the packet should be promotable with minor/no further review changes.

## Review Run Metadata

- generated_at: `2026-04-20T15:35:49`
- watcher_exit_code: `0`
- codex_tokens_used: `99,712`
