---
id: TASK-2026-04-15-0100-dispatch-approval-smoke
status: queued
type: docs
title: Dispatch approval flow smoke packet
priority: low
planned_by: codex
planned_at: 2026-04-15T01:00:00+09:00
planned_against_commit: af8aa5bef4d3c249ae0187c23fbc0837373c7589
---
# Goal

Validate the cowork review and approval flow itself with a harmless packet that is intended for process testing only.

# User Flow

- A maintainer places this packet in `cowork/packets/`
- `cowork_watcher.py` generates a review in `cowork/reviews/`
- Dispatch reads that review and asks for approval
- On approval, local automation promotes the packet to `tasks/inbox/` by default or `tasks/remote/` when requested

# UI Requirements

- None. This is a workflow smoke packet, not a product UI task.

# Acceptance Criteria

1. The packet is reviewable without missing required frontmatter.
2. The review can be read in Dispatch.
3. Dispatch can approve it for `inbox` or `remote`.
4. Approval should create `cowork/approvals/TASK-2026-04-15-0100-dispatch-approval-smoke.ok`.
5. Local automation should then promote the packet to the chosen queue.

# Constraints

- Do not implement product code from this packet.
- Use this packet only to validate the cowork review and approval path.
- If promoted to `tasks/inbox/`, a maintainer may move it back out after confirming the approval flow works.

# Non-goals

- Shipping a user-facing feature
- Editing source code
- Updating project docs as part of this packet itself

# Edge Cases

- Dispatch reads an outdated review and should refuse approval until the review is refreshed.
- Approval defaults to `inbox` when no target is specified.
- Remote approval should require `target: remote`.

# Open Questions

- None.

# Transport Notes

- This packet exists only for manual approval-flow testing.
- Preferred approval target for the first smoke test is `inbox`.
