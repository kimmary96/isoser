# Slack Approval Setup

Slack에서 `/isoser-approve`로 cowork approval marker를 만들기 위한 운영 설정 문서입니다.

## 목적
- `cowork_watcher.py`가 Slack으로 `review-ready`를 알리면
- 승인자는 Slack slash command로 `cowork/approvals/<task-id>.ok`를 만들고
- 이후 `cowork_watcher.py`가 packet을 `tasks/inbox` 또는 `tasks/remote`로 승격한다

## 사전 조건
- backend가 외부에서 접근 가능한 URL로 실행 중이어야 한다
- `cowork_watcher.py`가 실행 중이어야 한다
- Slack App을 만들 권한이 있어야 한다
- Slack incoming webhook과 slash command를 같은 워크스페이스에서 설정해야 한다

## 필요한 환경변수

### root `.watcher.env`
- `SLACK_WEBHOOK_URL`
  - cowork watcher의 `review-ready`, `review-failed`, `approval-blocked-stale-review`, `promoted` 알림 전송용

예시:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

### `backend/.env`
- `SLACK_SIGNING_SECRET`
  - Slack slash command 요청 서명 검증용
- `SLACK_APPROVER_USER_IDS`
  - 승인 가능한 Slack 사용자 ID allowlist

예시:

```env
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_APPROVER_USER_IDS=U12345678,U87654321
```

## Slack App 설정

### 1. Slash Commands 활성화
- Slack App 관리 화면에서 `Slash Commands`를 켠다
- command name:
  - `/isoser-approve`
- request URL:
  - `https://<your-backend-host>/slack/commands/cowork-approve`
- short description 예시:
  - `Approve a cowork task packet for promotion`
- usage hint 예시:
  - `<TASK-ID> [inbox|remote]`

### 2. Signing secret 복사
- Slack App 관리 화면의 `Basic Information`에서 `Signing Secret`를 확인한다
- 이 값을 `backend/.env`의 `SLACK_SIGNING_SECRET`에 넣는다

### 3. Approver Slack user ID 수집
- Slack에서 승인 가능한 사용자들의 user ID를 확인한다
- `backend/.env`의 `SLACK_APPROVER_USER_IDS`에 쉼표로 구분해 넣는다

예시:

```env
SLACK_APPROVER_USER_IDS=U04ABCDEF,U09HIJKLM
```

## 실행 순서
1. root `.watcher.env`에 `SLACK_WEBHOOK_URL`을 넣는다
2. `backend/.env`에 `SLACK_SIGNING_SECRET`, `SLACK_APPROVER_USER_IDS`를 넣는다
3. backend를 재시작한다
4. `cowork_watcher.py`를 재시작한다
5. Slack App slash command 설정을 저장한다
6. Slack 채널에서 승인 명령으로 smoke test를 한다

## 재시작 명령

### backend
프로젝트 환경에 맞는 기존 backend 실행 명령을 사용한다. 예시:

```powershell
cd backend
venv\Scripts\python.exe -m uvicorn main:app --reload
```

### cowork watcher

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_cowork_watcher.ps1
```

## 사용 방법

### 기본 inbox 승격

```text
/isoser-approve TASK-2026-04-15-0951-programs-hub-mvp
```

### remote 승격

```text
/isoser-approve TASK-2026-04-15-0951-programs-hub-mvp remote
```

### 명령 규칙
- 첫 번째 인자는 반드시 task id여야 한다
- 두 번째 인자는 선택이며 `inbox` 또는 `remote`만 허용한다
- 두 번째 인자를 생략하면 기본값은 `inbox`다

## 승인 거절 조건
- approver가 `SLACK_APPROVER_USER_IDS`에 없을 때
- packet이 존재하지 않을 때
- review가 아직 없을 때
- packet 수정 시각이 review보다 늦어서 stale review일 때
- 이미 `cowork/dispatch/<task-id>-promoted.md`가 존재할 때

## 스모크 테스트 체크리스트
1. Slack에서 `review-ready` 알림이 도착하는지 확인한다
2. Slack에서 `/isoser-approve <TASK-ID>`를 실행한다
3. backend 응답이 `Approved <TASK-ID> for inbox...` 형태인지 확인한다
4. `cowork/approvals/<task-id>.ok` 파일이 생성되는지 확인한다
5. 잠시 후 `cowork/dispatch/<task-id>-promoted.md`가 생성되는지 확인한다
6. 대상 packet이 `tasks/inbox/` 또는 `tasks/remote/`로 복사되는지 확인한다

## 운영 메모
- Slack approval은 slash command만 지원한다
- 버튼 클릭형 interactivity와 modal approval은 아직 구현하지 않았다
- stale review 보호는 Slack 승인에서도 그대로 유지된다
- packet을 review 이후 다시 수정하면 다시 review를 받아야 한다
