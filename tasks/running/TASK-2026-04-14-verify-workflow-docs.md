---
id: TASK-2026-04-14-VERIFY-WORKFLOW-DOCS
status: queued
type: docs
title: Verify workflow documentation consistency across automation docs
priority: low
planned_by: claude
planned_at: 2026-04-14T21:30:00+09:00
planned_against_commit: 0fd567321a4b28b7b6cba29ef210aedba83694f1
---

# Goal
Make sure the newly introduced Claude/Codex automation workflow is described consistently across the repository documents.

# User Flow
- Open the core workflow documents.
- Compare local and remote task execution descriptions.
- Fix wording or references if a document is outdated or inconsistent.
- Leave the repository in a state where a teammate can understand the automation path without guessing.

# UI Requirements
- None.

# Acceptance Criteria
1. `CLAUDE.md`, `docs/current-state.md`, and `docs/codex-workflow.md` describe the same local and remote automation structure.
2. Task packet locations are consistent everywhere.
3. Local watcher and remote fallback responsibilities are not described ambiguously.
4. The change stays documentation-only unless a small supporting clarification is necessary.

# Constraints
- Prefer minimal edits.
- Keep the local-first workflow intact.
- Do not redesign the automation structure in this task.

# Non-goals
- Changing GitHub Actions behavior
- Changing watcher runtime behavior
- Introducing new automation tools

# Edge Cases
- One document may still mention `specs/` as the primary path.
- One document may describe the remote path as Codex instead of Claude.
- Some wording may still imply push-based local execution.

# Open Questions
- None at the moment.
