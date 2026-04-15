# Operations

## Recommended commands
- local watcher start:
  - `powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1`
- cowork watcher start:
  - `powershell -ExecutionPolicy Bypass -File scripts/run_cowork_watcher.ps1`

## Local watcher env
- `scripts/run_watcher.ps1`는 저장소 루트 `.watcher.env`를 자동 로드한다
- `scripts/run_cowork_watcher.ps1`도 저장소 루트 `.watcher.env`를 자동 로드한다
- `SLACK_WEBHOOK_URL`이 있으면 terminal alert를 Slack에도 전송한다
- `cowork_watcher.py`도 `review-ready`, `review-failed`, `approval-blocked-stale-review`, `promoted` 상태를 Slack으로 미러링한다
- local watcher의 `needs-review` alert는 자동 복구가 막힌 task를 `cowork/packets/`으로 에스컬레이션했다는 뜻이며, 이어서 cowork watcher의 `review-ready` 승인 흐름으로 넘긴다
- 없으면 watcher 시작 시 경고를 출력하고 로컬 dispatch 파일에만 기록한다

## Slack approval command
- Slack에서 직접 approval marker를 만들려면 backend에 interactivity endpoint와 slash command를 연결한다
- `review-ready` Slack 메시지는 버튼형 action payload를 보낸다
- interactivity 엔드포인트: `POST /slack/interactivity/cowork-review`
- 엔드포인트: `POST /slack/commands/cowork-approve`
- slash command 예시: `/isoser-approve TASK-2026-04-15-0951-programs-hub-mvp remote`
- 인자 형식: `<TASK-ID> [inbox|remote]`
- 버튼 액션:
  - `승인`: inbox approval marker 생성
  - `원격`: remote approval marker 생성
  - `거절`: `cowork/dispatch/<task-id>-review-rejected.md` 기록
- review가 없거나 stale이면 approval marker를 만들지 않고 거절한다
- 승인 가능 사용자 목록은 backend env `SLACK_APPROVER_USER_IDS`로 제한한다
- 서명 검증은 backend env `SLACK_SIGNING_SECRET`로 수행한다
- 실제 Slack App 설정 절차와 smoke test는 [slack-approval-setup.md](./slack-approval-setup.md)에 정리한다

## Shared watcher utilities
- `scripts/watcher_shared.py`는 watcher 공통 저수준 유틸만 담당한다
- queue 정책, alert 포맷, promotion 규칙 같은 workflow 판단은 각 watcher 파일에 남긴다
- 공통 경계 변경 시 [watcher-shared.md](./watcher-shared.md)도 같이 갱신한다

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
