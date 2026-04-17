# Overall assessment

Not ready for promotion.

The packet has all required frontmatter fields, `planned_against_commit: 5206453` resolves in this repository, and there is low committed drift in the directly touched resume/dashboard/program files since that commit. There is no optional `planned_files` or `planned_worktree_fingerprint` metadata in the packet, so there was nothing to verify for those fields. However, the packet is still not execution-ready because its dependency state is unresolved in the current repo, and several implementation and acceptance details are underspecified against the actual codebase.

# Findings

- Frontmatter completeness passes: `id`, `status`, `type`, `title`, `planned_at`, and `planned_against_commit` are present.
- Repository path accuracy is mostly correct at the route level, but the current implementation surfaces are more specific than the packet states. The existing resume builder lives in `frontend/app/dashboard/resume/page.tsx`, `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`, and `frontend/app/api/dashboard/resume/route.ts`. The program detail route exists at `frontend/app/(landing)/programs/[id]/page.tsx`. The calendar UI already exists in `frontend/app/dashboard/page.tsx` with `frontend/components/minicalendar.tsx`.
- Dependency readiness fails in the current repository state. `TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar` and `TASK-2026-04-17-1510-dashboard-ai-calendar-view` exist only under `cowork/packets/` and `cowork/reviews/`; they are not present in `tasks/done/`, `tasks/inbox/`, or `tasks/remote/`. The packet itself says those tasks must be completed before the flow actually works.
- The packet says to replace `planned_against_commit` with latest `HEAD` before execution. That should be done before promotion so the execution packet is self-consistent.
- Drift risk in the touched code is low, but baseline behavior is more constrained than the packet implies. Current `/dashboard/resume` has one fetch path (`GET /api/dashboard/resume`) and one create path (`POST /api/dashboard/resume`), with no query-param handling, no prefill route, no source tracking, and no resume draft summary field.
- Schema/reference gap: the current `resumes` table and `Resume` type only contain `title`, `target_job`, `template_id`, and `selected_activity_ids` plus timestamps. `source_program_id` does not exist yet, which the packet already accounts for via migration. More importantly, `summary` is not a resume field anywhere in the current schema or route contract, but the packet treats it as a prefilled field in the main flow. That needs to be clarified before promotion: either add/mention the real destination field, or mark `summary` as UI-only/non-persisted in this task.
- The save contract is underspecified against current code. Current `createResumeDocument()` and `POST /api/dashboard/resume` do not accept `source_program_id`, prefill metadata, or any distinction between auto-selected and manually selected activities. The packet should explicitly call out the expected request/response contract changes.
- The packet references reuse of `_program_match_context`, and that seam does exist in `backend/rag/programs_rag.py`, not only conceptually. That part is grounded. But the packet leaves the execution boundary ambiguous by saying the BFF should expose `GET /api/dashboard/resume/prefill?program_id=<id>` while also saying FastAPI passthrough is preferred. It should explicitly state the backend endpoint that the BFF will call.
- Acceptance clarity is incomplete for the “already editing existing resume” case. The packet requires a two-step confirmation instead of overwrite, but current `/dashboard/resume` is a builder that creates new resumes and does not load a draft editing session in-place. The packet should define what concrete state counts as “already editing” in the current implementation.
- Acceptance clarity is incomplete for auto/manual badge behavior. The packet requires removing the “자동 선택” badge after manual toggle and persisting that distinction on save, but it does not define where that manual-vs-auto state lives or whether it must survive page reload before save.
- Missing references: the packet should directly reference the currently relevant files so the executor does not have to infer them:
  `frontend/app/dashboard/page.tsx`
  `frontend/components/minicalendar.tsx`
  `frontend/app/dashboard/resume/page.tsx`
  `frontend/app/dashboard/resume/_hooks/use-resume-builder.ts`
  `frontend/app/api/dashboard/resume/route.ts`
  `frontend/lib/api/app.ts`
  `frontend/lib/types/index.ts`
  `backend/rag/programs_rag.py`
- Current worktree check: there are unrelated uncommitted changes in cowork/dispatch, docs, and watcher files, but nothing in the directly relevant resume/dashboard/program implementation files. That does not block review, but it reinforces the need to refresh `planned_against_commit` before promotion.

# Recommendation

Do not promote yet.

Exactly what must change before promotion:

- Update `planned_against_commit` to current `HEAD`.
- Resolve the dependency condition explicitly: either wait until `1500` and `1510` are actually merged/promoted into the execution baseline, or rewrite this packet so it can execute independently without assuming their CTA/path changes already exist.
- Clarify the `summary` requirement against the real repository state. If `summary` is UI-only, say so explicitly. If it must persist, name the schema/API change required.
- Name the exact backend endpoint that will power `GET /api/dashboard/resume/prefill`, not just the BFF shape.
- Define the save-payload change explicitly, including `source_program_id` and whether manual-vs-auto selection state must be stored or only affect UI before save.
- Tighten the “already editing existing resume” acceptance so it maps to the current builder behavior instead of an implied draft-edit flow.
- Add direct references to the current touched files listed above.

After those fixes, the packet is promotable with minor changes rather than a full rewrite.

## Review Run Metadata

- generated_at: `2026-04-17T12:29:48`
- watcher_exit_code: `0`
- codex_tokens_used: `118,808`
