# Dispatch Review Approval Prompt

Use this in Dispatch when you want Dispatch to act as the review-and-approval layer for cowork task packets.

```text
Check `cowork/reviews/` for the newest `*-review.md` file.

For that review:
1. Read the full review
2. Read the matching packet from `cowork/packets/`
3. Compare timestamps or freshness indirectly:
   - if the packet appears newer than the review, stop and tell me the review is stale
   - if stale, instruct the local cowork watcher to regenerate the review before asking for approval
4. Summarize:
   - task id
   - overall assessment
   - blocking findings
   - recommendation
5. Ask me clearly:
   - approve for inbox
   - approve for remote
   - reject

If I approve for inbox:
- create `cowork/approvals/<task-id>.ok`
- write:
  approved_by: dispatch
  target: inbox
  approved_at: <current ISO timestamp>
  note: approved after dispatch review

If I approve for remote:
- create `cowork/approvals/<task-id>.ok`
- write:
  approved_by: dispatch
  target: remote
  approved_at: <current ISO timestamp>
  note: approved for remote fallback after dispatch review

If I reject:
- do not create the approval file
- optionally write `cowork/dispatch/<task-id>-rejected.md`

Important:
- Do not approve from an outdated review
- If the review is stale, tell me to regenerate it first
- Approval should only create the approval file; local automation remains the source of truth for promotion
```
