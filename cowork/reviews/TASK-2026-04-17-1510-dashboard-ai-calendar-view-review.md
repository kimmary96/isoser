## Overall assessment

Not ready for promotion. The packet is directionally aligned with the product goal, but it has material drift against the current repository and one invalid planning anchor. It should be revised before moving to `tasks/inbox/`.

## Findings

- Frontmatter completeness: required fields are present (`id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`).
- Planning anchor is invalid: `planned_against_commit: 5206453` does not resolve to a commit in the current repository, so drift cannot be evaluated against the declared baseline. The packet itself also says to replace this with latest `HEAD` before execution.
- Existing implementation drift is significant in the touched area: [frontend/app/dashboard/page.tsx](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/app/dashboard/page.tsx) already renders `MiniCalendar`, already shows an `AI 맞춤 취업 지원 캘린더` section, and already fetches recommended programs from the current BFF. This is not a net-new section addition.
- API target drift: the live BFF is [frontend/app/api/dashboard/recommended-programs/route.ts](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/app/api/dashboard/recommended-programs/route.ts), which calls `POST /programs/recommend`, not `GET /api/dashboard/recommend-calendar` -> FastAPI `GET /recommend/calendar` as stated in the packet. The packet needs to say whether this task replaces the existing flow or layers on top of it.
- Dependency is not execution-ready: `TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar` exists only under `cowork/packets/` and is not present in `tasks/inbox/` or `tasks/remote/`. The dependency should be confirmed as approved/merged before this packet is promoted.
- Acceptance ambiguity: the packet says the list should be shown in "마감 임박순" / "마감일 기준 정렬", but Acceptance 3 says `final_score desc`, tie `deadline asc`. Those are different behaviors and need one authoritative rule.
- Empty/error behavior is ambiguous: UI requirements say empty state should show a message and CTA, while other sections say the section should be hidden on error and Acceptance 7 says "섹션 숨김 또는 빈 상태 메시지 표시". Promotion-ready packets should choose one behavior for empty and one for error.
- Resume CTA target is only partially specified: `/dashboard/resume?prefill_program_id=<id>` is a valid placeholder URL, but current resume code has no query-param handling. That is acceptable as a non-goal only if the packet explicitly says the page does not need to react to the param in this task beyond receiving the link.
- Path accuracy is mostly acceptable: the user-facing route `/programs/[id]` exists, but the actual file lives at [frontend/app/(landing)/programs/[id]/page.tsx](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/app/(landing)/programs/[id]/page.tsx). The packet is correct as a route contract, but not as a repository path reference.
- Missing repository references: the packet should reference the existing touched files and patterns that are already in play, especially [frontend/app/dashboard/page.tsx](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/app/dashboard/page.tsx), [frontend/components/MiniCalendar.tsx](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/components/MiniCalendar.tsx), [frontend/app/api/dashboard/recommended-programs/route.ts](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/app/api/dashboard/recommended-programs/route.ts), and [frontend/lib/types/index.ts](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/lib/types/index.ts).
- Optional metadata check: `planned_files` and `planned_worktree_fingerprint` are not present in the packet, so there was nothing to verify for those fields.
- Worktree note: the repo currently has unrelated uncommitted changes, including `docs/current-state.md`, `docs/refactoring-log.md`, `watcher.py`, and test/log files. That does not block packet review by itself, but it makes an invalid `planned_against_commit` more risky.

## Recommendation

Do not promote yet.

Exactly what must change before promotion:

- Replace `planned_against_commit` with a real current commit SHA from this repository.
- Rewrite the task body so it acknowledges the current dashboard already has a calendar section and states whether the task is an incremental refactor/replacement of [frontend/app/dashboard/page.tsx](/abs/path/D:/02_2025_AI_Lab/isoser/frontend/app/dashboard/page.tsx) rather than a first-time addition.
- Resolve the API contract mismatch by choosing one target:
  either keep the existing `recommended-programs` flow and describe the needed extension,
  or explicitly replace it with the new `recommend-calendar` BFF/backend endpoints.
- Resolve the sorting rule conflict and make acceptance criteria match the chosen rule.
- Resolve empty/error behavior into one testable expected behavior each.
- Confirm the dependency task is approved and promoted or otherwise available in the execution baseline.
- Add direct references to the already-existing dashboard/calendar files the implementer is expected to modify or extend.

After those fixes, the packet should be re-reviewed. In its current state, it is not promotable.

## Review Run Metadata

- generated_at: `2026-04-17T12:27:34`
- watcher_exit_code: `0`
- codex_tokens_used: `92,654`
