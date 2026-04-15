---
id: TASK-2026-04-14-DOCS-RUNTIME-ALIGNMENT
status: queued
type: docs
title: Align runtime and auth wording across top-level docs
priority: low
planned_by: claude
planned_at: 2026-04-14T21:20:00+09:00
planned_against_commit: 3a8be4218476bd3511543759c55409ecca497621
---

# Goal
Bring top-level project docs into alignment on backend Python version, guest-mode status, and the recommended backend virtual environment path.

# User Flow
- Open the main project-facing docs.
- Check whether backend runtime and auth assumptions are described consistently.
- Fix only the mismatched wording.

# UI Requirements
- None.

# Acceptance Criteria
1. `CLAUDE.md` and `README.md` no longer disagree on the backend Python version.
2. Top-level docs do not describe guest mode as an active current feature if it has already been removed.
3. The recommended backend virtual environment path is described consistently in touched top-level docs.
4. The change remains documentation-only and limited in scope.

# Constraints
- Touch only the smallest set of documentation files needed.
- Do not rewrite unrelated README or CLAUDE sections.
- Prefer exact wording fixes over broad cleanup.

# Non-goals
- Changing application code
- Reworking the full README structure
- Revisiting old project phase history

# Edge Cases
- Some sections may describe historical state rather than current state.
- A file may intentionally preserve legacy context, so only change statements that read as current operational guidance.

# Open Questions
- None.
