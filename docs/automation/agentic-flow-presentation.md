# Isoser 에이전트 플로우 발표용 요약

## 어떤 문서를 기준으로 보면 되나
- end-to-end 원본 기준 문서: [local-flow.md](./local-flow.md)
- 전체 역할과 경로를 한눈에 보는 보조 문서: [overview.md](./overview.md)
- 발표할 때는 이 문서를 먼저 보여주고, 질문이 나오면 `local-flow.md`로 내려가는 방식이 가장 이해가 쉽다.

## 한 줄 요약
- 사람이 task packet을 만들고 승인하면, watcher들이 검토 -> 실행 -> 검증 -> 복구/에스컬레이션까지 자동으로 이어주는 구조다.

## 왜 이 구조를 쓰나
- 기획 문서와 실제 실행 큐를 분리해서, review 중인 초안이 바로 실행되지 않게 한다.
- 구현 전에 현재 저장소 상태를 다시 점검해서 stale task를 줄인다.
- 실패를 `drift`, `blocked`, `review-required`로 나눠서 다음 액션을 명확히 한다.
- 반복되는 운영 문제는 watcher가 직접 self-healing 하거나 자동 remediation task로 되돌린다.

## 전체 흐름 1장 버전
1. 사람이 `cowork/packets/<task-id>.md`에 task packet 초안을 만든다.
2. `cowork_watcher.py`가 현재 저장소 기준으로 review 문서 `cowork/reviews/<task-id>-review.md`를 만든다.
3. 사람은 review를 보고 packet 원본을 수정한다.
4. 사람이 승인하면 최신 packet 사본이 `tasks/inbox/` 또는 `tasks/remote/`로 승격된다.
5. 로컬 실행이면 `watcher.py`가 packet을 `tasks/running/`으로 옮긴다.
6. watcher supervisor가 `inspector -> implementer -> verifier` 순서로 실행한다.
7. 결과에 따라 task는 `done`, `drifted`, `blocked`, `review-required` 중 하나로 이동한다.
8. `drifted`와 `blocked`는 자동 복구 가능하면 다시 `tasks/inbox/`로 돌아간다.
9. 자동 복구가 안 되면 다시 `cowork/packets/` 경로로 올려 사람이 재승인하거나 범위를 조정한다.

## 역할별 설명

### 1. Planner / Reviewer
- 사람이 packet을 정의한다.
- 실행 전에 review를 보고 범위, acceptance criteria, 전제조건을 다듬는다.
- 즉, 사람은 "무엇을 해야 하는가"와 "이 packet이 지금 실행 가능한가"를 책임진다.

### 2. `cowork_watcher.py`
- `cowork/packets/`를 감시한다.
- packet을 현재 저장소 상태와 비교해 review 문서를 만든다.
- 승인된 최신 packet만 실행 큐로 복사한다.
- 핵심은 draft 공간과 execution queue를 분리하는 것이다.

### 3. `watcher.py`
- `tasks/inbox/`를 실제 실행 큐로 본다.
- packet을 `tasks/running/`으로 이동시키고 supervisor 플로우를 시작한다.
- 완료 후에는 report, alert, git automation, recovery까지 담당한다.

### 4. Supervisor 3단계
- Inspector:
  - packet과 현재 저장소가 아직 맞는지 먼저 본다.
  - handoff 문서 `reports/<task-id>-supervisor-inspection.md`를 만든다.
- Implementer:
  - inspection handoff를 읽고 실제 구현과 result report를 만든다.
- Verifier:
  - inspection/result를 읽고 최종 검증한다.
  - 통과면 `pass`, 사람 검토가 더 필요하면 `review-required`를 남긴다.

## 폴더를 이렇게 이해하면 된다
- `cowork/packets/`
  - 사람이 계속 수정하는 원본 packet
- `cowork/reviews/`
  - packet에 대한 review 결과
- `tasks/inbox/`
  - 승인된 최신 packet 사본이 들어가는 실제 실행 대기열
- `tasks/running/`
  - 현재 실행 중인 packet
- `tasks/done/`
  - 성공 완료
- `tasks/drifted/`
  - packet과 현재 저장소가 어긋남
- `tasks/blocked/`
  - 외부 의존성, 실행 실패, 메타데이터 누락 등으로 중단
- `tasks/review-required/`
  - verifier가 사람 재검토를 요청한 전용 큐

## 성공 / 실패 / 재시도 흐름

### 성공
- 산출물:
  - inspection report
  - verification report
  - result report
- 상태:
  - `tasks/done/`
- 후처리:
  - watcher가 task-scoped git commit/push를 시도한다.

### Drift
- 의미:
  - packet이 계획 당시 저장소 상태와 지금이 달라져 안전하지 않다.
- 결과:
  - `tasks/drifted/`
  - drift report 생성
- 다음 액션:
  - watcher가 자동 복구를 시도하거나, 안 되면 사람에게 다시 올린다.

### Blocked
- 의미:
  - 실행은 했지만 외부 전제조건, 누락 정보, 예외 등으로 멈췄다.
- 결과:
  - `tasks/blocked/`
  - blocked report 생성
- 다음 액션:
  - 자동 복구 가능하면 재큐잉, 아니면 사람 승인 경로로 복귀

### Review Required
- 의미:
  - 구현은 됐지만 verifier가 "이건 사람 판단이 한 번 더 필요하다"고 본 상태
- 결과:
  - `tasks/review-required/`
- 특징:
  - 일반 blocked와 다르게 품질/수용 기준 재검토에 가깝다.

## 자동 복구와 self-healing
- 자동 복구:
  - `drifted`, `blocked` task를 watcher가 다시 읽고 packet을 보정해 재큐잉하는 흐름
- self-healing:
  - 반복되거나 이미 알려진 운영성 문제는 watcher가 바로 수습하는 흐름
- 현재 예시:
  - `origin/main` 자동 반영 스킵은 비차단 `self-healed` 정보 알림으로 다운그레이드
  - 이미 `tasks/done/`에 완료본이 있을 때 생기는 중복 packet runtime-error는 자동 archive

## 슬랙은 어디에 쓰이나
- review-ready 승인/거절
- watcher 상태 알림 mirror
- 같은 task의 후속 상태를 thread로 이어 보기
- 즉, Slack은 "실행 엔진"이 아니라 "사람 개입 지점과 운영 관측 채널"이다.

## 팀원들에게 설명할 때 자주 헷갈리는 포인트
- `cowork/packets/`는 실행 큐가 아니다.
- `cowork/reviews/`는 참고 문서이지 실행 입력이 아니다.
- 실제 실행 입력은 승인 후 복사된 `tasks/inbox/` packet이다.
- blocked와 review-required는 다르다.
  - blocked는 실행 실패/전제조건 문제
  - review-required는 verifier가 사람 판단을 요청한 상태
- watcher는 단순 실행기만이 아니라 recovery와 운영 자동화까지 포함한다.

## 발표용 3분 스크립트
- "이 구조는 사람의 기획 초안과 실제 실행 큐를 분리한 게 핵심입니다."
- "먼저 사람이 `cowork/packets`에 task를 쓰면 cowork watcher가 review를 만듭니다."
- "승인된 최신 packet만 `tasks/inbox`로 넘어가고, 그때부터 local watcher가 실행합니다."
- "실행도 한 번에 하지 않고 inspector, implementer, verifier 세 단계로 나눠서 안전하게 갑니다."
- "그래서 결과는 단순 성공/실패가 아니라 done, drifted, blocked, review-required로 분기됩니다."
- "drift와 blocked는 watcher가 자동 복구를 시도하고, 안 되면 다시 사람 review 경로로 올립니다."
- "즉, 이 플로우는 AI가 혼자 다 하는 구조가 아니라, 사람이 개입해야 할 지점을 명확히 분리한 반자동 운영 구조입니다."

## 발표 슬라이드 추천 구성
1. 왜 이 구조가 필요한가
2. 전체 end-to-end 9단계
3. `cowork_watcher.py`와 `watcher.py` 역할 분리
4. supervisor 3단계 설명
5. 상태 분기: done / drifted / blocked / review-required
6. 자동 복구와 self-healing
7. Slack과 사람 승인 지점
8. Q&A
