---
id: TASK-2026-04-14-RESUME-BIO-SAVE-GUARD
status: queued
type: fix
title: Prevent redundant bio save requests in resume preview
priority: medium
planned_by: claude
planned_at: 2026-04-14T22:20:00+09:00
planned_against_commit: 3a8be4218476bd3511543759c55409ecca497621
---

# Goal
Reduce unnecessary profile `bio` save requests from the resume preview input without redesigning the page.

# User Flow
- Open `/dashboard/resume`
- Focus the `bio` input under the name in the preview pane
- Type a value and blur or press Enter
- The app should save when the value meaningfully changed
- Repeated blur/Enter on the same trimmed value should not trigger extra save requests

# UI Requirements
- Keep the existing resume preview layout and input placement
- Preserve the existing lightweight saving feedback pattern

# Acceptance Criteria
1. The resume preview `bio` input saves only when the trimmed value changed from the last known saved value.
2. Pressing Enter and then blur on the same unchanged value does not cause duplicate save requests.
3. The fix stays scoped to the resume builder area unless a small shared helper is already used there.
4. Error handling and visible save feedback continue to work.

# Constraints
- Inspect only the files directly related to the resume preview bio save flow first.
- Prefer a local hook/component fix over broader profile-state redesign.
- Keep the diff small.

# Non-goals
- Redesigning the resume page
- Adding a new global toast/notification system
- Reworking profile saving across the whole dashboard

# Edge Cases
- The current bio is empty and the user blurs without entering anything
- The user adds whitespace only
- Save is already in progress when another trigger fires

# Open Questions
- None.
