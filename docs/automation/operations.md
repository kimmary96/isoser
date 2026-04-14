# Operations

## Recommended commands
- local watcher start:
  - `powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1`
- cowork watcher start:
  - `powershell -ExecutionPolicy Bypass -File scripts/run_cowork_watcher.ps1`

## Local watcher env
- `scripts/run_watcher.ps1`는 저장소 루트 `.watcher.env`를 자동 로드한다
- `SLACK_WEBHOOK_URL`이 있으면 terminal alert를 Slack에도 전송한다
- 없으면 watcher 시작 시 경고를 출력하고 `dispatch/alerts/`에만 기록한다

## Restart checklist
- short checklist: [../rules/watcher-restart-checklist.md](../rules/watcher-restart-checklist.md)

## Retention notes
- `tasks/done/`과 `reports/`는 소형 markdown 파일이 누적되는 구조다
- 폴더가 너무 시끄러워지면 삭제보다 archive 이동을 우선한다
  - `tasks/archive/<YYYY-MM>/`
  - `reports/archive/<YYYY-MM>/`

## Current limitations
- remote fallback은 아직 Claude Code 기반이다
- external planning tools에서 `tasks/inbox/`로 직접 들어오는 자동 bridge는 없다
- OAuth smoke test는 참고용 기록일 뿐 active path가 아니다
