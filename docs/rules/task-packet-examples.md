# Narrow Task Packet Examples

## Example 1: Small docs update

```md
---
id: TASK-2026-04-14-2245-docs-link-check
status: queued
type: docs
title: Fix one outdated internal docs link in README
priority: low
planned_by: claude
planned_at: 2026-04-14T22:45:00+09:00
planned_against_commit: <git-sha>
planned_files: README.md
planned_worktree_fingerprint: <optional-sha256>
---

# Goal
Fix a single outdated documentation link in the root README.

# User Flow
- Open `README.md`
- Find the outdated internal reference
- Replace it with the correct current docs path

# UI Requirements
- None.

# Acceptance Criteria
1. Only `README.md` is changed unless a directly linked docs file must also be adjusted.
2. The corrected link points to an existing current document.
3. No unrelated README wording is rewritten.

# Constraints
- Keep the change limited to the smallest possible docs diff.

# Non-goals
- README restructuring
- wording cleanup outside the broken link

# Edge Cases
- The target doc may already have been renamed again.

# Open Questions
- None.
```

## Example 2: Small frontend fix

```md
---
id: TASK-2026-04-14-2250-activity-save-feedback
status: queued
type: fix
title: Improve save feedback in activity detail without changing page structure
priority: medium
planned_by: claude
planned_at: 2026-04-14T22:50:00+09:00
planned_against_commit: <git-sha>
planned_files: frontend/app/dashboard/activities/[id]/page.tsx, frontend/app/dashboard/activities/_hooks/use-activity-detail.ts
planned_worktree_fingerprint: <optional-sha256>
---

# Goal
Make activity detail save feedback clearer for the user without redesigning the page.

# User Flow
- Edit an activity in the detail page
- Save changes
- See a clear success or failure signal

# UI Requirements
- Reuse the existing feedback pattern if one already exists in the touched area
- Keep layout changes minimal

# Acceptance Criteria
1. The user gets visible feedback on save success and save failure.
2. The activity detail page layout stays substantially the same.
3. Only activity-detail-related files are touched unless a shared helper is already used there.

# Constraints
- Prefer local component or hook changes.
- Do not redesign the entire activity detail experience.

# Non-goals
- Reworking the whole activities domain
- Adding a new global notification system

# Edge Cases
- Save request fails
- User clicks save repeatedly
- Save succeeds but returned data is stale

# Open Questions
- None.
```

## Naming recommendation

- Include local time in both the `id` and filename when creating task packets on the same day.
- Recommended format:
  - `TASK-YYYY-MM-DD-HHMM-short-slug.md`
- Example:
  - `TASK-2026-04-14-2250-activity-save-feedback.md`

## Optional stability fields

- `planned_files`는 packet이 실제로 기준 삼는 touched area를 좁게 적는다.
- `planned_worktree_fingerprint`는 `planned_files` 기준 현재 worktree snapshot hash다.
- 생성 예시:
  - `python scripts/compute_task_fingerprint.py --frontmatter README.md`
