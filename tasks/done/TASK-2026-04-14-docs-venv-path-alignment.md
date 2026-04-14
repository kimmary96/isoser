---
id: TASK-2026-04-14-DOCS-VENV-PATH-ALIGNMENT
status: queued
type: docs
title: Align backend virtual environment path wording across docs
priority: low
planned_by: claude
planned_at: 2026-04-14T21:35:00+09:00
planned_against_commit: 3a8be4218476bd3511543759c55409ecca497621
---

# Goal
Make the documented recommended backend virtual environment path consistent across top-level docs.

# User Flow
- Open the small set of docs that mention the backend virtual environment path.
- Identify the current mismatch.
- Standardize the wording without touching unrelated documentation.

# UI Requirements
- None.

# Acceptance Criteria
1. `CLAUDE.md` and `docs/current-state.md` use the same recommended backend virtual environment path.
2. No unrelated wording cleanup is added.
3. The task remains documentation-only.

# Constraints
- Inspect only the files needed for this wording fix.
- Prefer the smallest possible diff.

# Non-goals
- Application code changes
- Broader README cleanup
- Python runtime wording changes outside the venv path

# Edge Cases
- One file may describe an operational default while another reflects a local convention.

# Open Questions
- None.
