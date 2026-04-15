---
id: TASK-2026-04-14-DOCS-WORKLOG-VENV-NOTE
status: queued
type: docs
title: Align one backend venv path note in match rewrite worklog
priority: low
planned_by: claude
planned_at: 2026-04-14T22:35:00+09:00
planned_against_commit: 3a8be4218476bd3511543759c55409ecca497621
---

# Goal
Update one outdated backend virtual environment path note in the match rewrite worklog so it matches the current repository naming.

# User Flow
- Open the existing worklog document
- Find the single backend virtual environment path note
- Replace only that wording

# UI Requirements
- None.

# Acceptance Criteria
1. Only `docs/2026-04-06-match-rewrite-worklog.md` is changed unless a directly required report file is created.
2. The backend virtual environment path wording matches the current repository convention.
3. No unrelated wording cleanup or historical rewrite is added.

# Constraints
- Inspect only the task file and the single target document before editing.
- Keep the diff to the smallest possible wording change.

# Non-goals
- Broader worklog cleanup
- Runtime or Python version wording changes
- Any application code changes

# Edge Cases
- The line may be part of a historical note and should keep its original meaning while updating only the path text.

# Open Questions
- None.
