---
id: TASK-2026-04-14-README-AUTOMATION-SUMMARY
status: queued
type: docs
title: Sync README automation summary with current Claude/Codex workflow
priority: medium
planned_by: claude
planned_at: 2026-04-14T22:35:00+09:00
planned_against_commit: d1b73b8e48de65b1abf757448aed2aded7c33f0b
---

# Goal
Update the repository README so a new contributor can understand the current local-first Claude/Codex automation flow without reading multiple internal docs first.

# User Flow
- Open the root README.
- Find where automation and task execution are documented.
- Understand the local path, remote fallback path, and where to look for detailed rules.

# UI Requirements
- None.

# Acceptance Criteria
1. README explains the difference between local `tasks/inbox` execution and remote `tasks/remote` fallback.
2. README points to the key supporting documents for deeper operational rules.
3. The summary is concise and does not duplicate every internal document verbatim.
4. Existing README sections remain readable after the addition.

# Constraints
- Keep the change documentation-focused.
- Prefer a short high-signal section over a long operations manual.
- Do not redesign the automation structure in this task.

# Non-goals
- Changing watcher runtime behavior
- Changing GitHub Action behavior
- Refactoring unrelated product documentation

# Edge Cases
- README may still contain outdated assumptions from earlier project phases.
- Automation terminology may be inconsistent with internal docs.

# Open Questions
- None.
