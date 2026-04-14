# Dispatch Alert Prompt

Use this in Dispatch when you want Dispatch to act as the local watcher alert triage layer.

```text
Check `dispatch/alerts/` for the newest unresolved `*.md` alert file.

For that alert:
1. Read the full alert file.
2. Read the linked report file if the alert includes a `report:` line.
3. Read the linked task packet if the alert includes a `packet:` line and the file still exists.
4. Summarize:
   - task id
   - stage
   - status
   - severity
   - summary
   - next action
5. Then tell me exactly what kind of operator response is needed:
   - `확인` for informational completed alerts
   - `재계획` for drift alerts
   - `수정` for blocked alerts
   - `푸시` for push-failed alerts
6. Keep the final choice prompt short:
   - `선택: 확인 / 재계획 / 수정 / 푸시`

Decision handling:

- If I say `확인`:
  - treat the alert as acknowledged
  - do not change packet state
  - optionally suggest archiving the alert later

- If I say `재계획`:
  - explain which packet must be regenerated or revised
  - point me to the drift report and current `HEAD`
  - do not create approval files automatically

- If I say `수정`:
  - explain the unblock action from the alert and blocked report
  - if the issue is straightforward, suggest the exact next command or edit

- If I say `푸시`:
  - explain whether the task already completed locally
  - point me to the `## Git Automation` section in the result report
  - tell me the likely manual git follow-up

Important:
- `cowork/dispatch/` and `dispatch/alerts/` are different channels.
- `cowork/dispatch/` is only for cowork packet review/promotion notes.
- `dispatch/alerts/` is only for local watcher terminal outcomes.
- Do not mix approval decisions with watcher alert triage.
```
