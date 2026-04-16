---
id: TASK-2026-04-16-1505-watcher-develop-push
status: queued
type: bug
title: "watcher git automation — develop 브랜치 push 후 main promotion 실패를 에러로 처리하지 않도록 수정"
planned_at: 2026-04-16T15:05:00+09:00
planned_against_commit: 8bb94c8dbc86630d49879795016a4e9618c7dc22
auto_recovery_attempts: 1
---

# Goal

`watcher.py`의 git automation 로직에서, 현재 브랜치가 `develop`일 때 `origin/main` fast-forward promotion이 실패하면 에러 알림(`push-failed`)을 발생시키는 문제를 수정한다.

develop 브랜치에서 작업하는 경우 `origin/main`이 커밋의 ancestor가 아닌 것은 정상이다. 이 상황에서는 `origin/develop`로의 push가 성공했으면 정상 완료로 처리해야 한다.

# Context

현재 `watcher.py` 891~914번 라인 로직:

1. `branch != "main"`이면 `origin/{branch}`로 push한 뒤, 추가로 `origin/main`으로 fast-forward promote를 시도한다
2. `merge-base --is-ancestor origin/main {commit}` 검사에 실패하면 `main-promotion-skipped`를 반환한다
3. watcher는 이 상태를 에러로 분류하고 `push-failed` severity 알림을 생성한다

문제: develop 브랜치에서 작업하면 main과 히스토리가 갈라져 있는 것이 당연하므로, 매번 불필요한 에러 알림이 발생한다.

# 작업 상세

`watcher.py`의 git commit/push 함수(891번 라인 부근)를 다음과 같이 수정한다:

1. `origin/{branch}` push가 성공하면 이것만으로 기본 성공 조건을 충족한다
2. `branch != "main"`일 때 main promotion 시도는 선택적(best-effort)으로 변경한다:
   - ancestry check 실패 시 → `main-promotion-skipped`를 info 수준으로 기록하되, 최종 반환 상태는 `pushed`(성공)로 처리한다
   - main push 실패 시 → 동일하게 info 로그만 남기고 최종 상태는 `pushed`로 처리한다
   - main push 성공 시 → 기존대로 `merged-main`으로 처리한다
3. 알림 분류 로직(1487번 라인 부근)에서 `main-promotion-skipped`를 에러 집합에서 제거한다. 대신 info 수준 알림으로 분류하거나, 알림을 생성하지 않는다

변경 대상 파일: `watcher.py` 1개 파일

# Acceptance Criteria

1. develop 브랜치에서 task 실행 후 `origin/develop`로 push가 성공하면 watcher가 정상 완료(`pushed` 또는 `merged-main`)로 처리한다
2. develop 브랜치에서 main promotion ancestry check가 실패해도 `push-failed` 또는 `action-required` 알림이 발생하지 않는다
3. main promotion이 가능한 경우(ancestry OK)에는 기존대로 자동 promote가 동작한다
4. main 브랜치에서 직접 작업한 경우의 기존 동작은 변경 없다
5. result report의 Git Automation 섹션에 실제 push 상태가 정확히 기록된다 (develop push 성공 시 `status: pushed`, main promotion도 성공 시 `status: merged-main`)

# Constraints

- `watcher.py` 외 파일 수정 금지
- main 브랜치 직접 작업 시의 기존 push 로직을 건드리지 않는다
- main promotion 성공 시의 기존 동작(`merged-main`)을 유지한다
- 알림 시스템의 다른 severity 분류를 변경하지 않는다
- 실행 전 `planned_against_commit`을 현재 HEAD로 교체할 것

# Non-goals

- develop → main 머지 전략 변경 (PR 기반 등)
- 브랜치 자동 생성/전환 로직 추가
- watcher 전체 리팩토링

# Edge Cases

- origin/main이 아예 존재하지 않는 경우: `git fetch origin main` 실패를 info로 처리하고 push 성공으로 마무리
- develop 브랜치에서 main과 히스토리가 완전히 분리된 경우: ancestry check 실패 → info 로그 → pushed로 정상 종료
- main 브랜치에서 작업했는데 push 실패한 경우: 기존대로 에러 알림 유지

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-16-1505-watcher-develop-push.md`
- 원격 실행: `tasks/remote/TASK-2026-04-16-1505-watcher-develop-push.md`
