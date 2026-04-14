# Watcher Shared Utilities

## Purpose

`scripts/watcher_shared.py`는 `watcher.py`와 `cowork_watcher.py`에 중복되던 저수준 유틸을 모아 둔 공통 모듈이다.

분리 목적은 세 가지다.

- watcher 두 종류가 같은 파일 처리 규칙을 공유하게 한다
- retry, lock, frontmatter 파싱처럼 자주 바뀌지 않는 동작을 한곳에서 관리한다
- queue 흐름 변경 시 `watcher.py`, `cowork_watcher.py`는 orchestration에만 집중하게 한다

## Current Scope

현재 공통 모듈이 담당하는 범위는 아래와 같다.

- 디렉터리 생성
- lock 파일 획득, 기록, 해제
- markdown 읽기, 쓰기
- task packet frontmatter 파싱
- 필수 frontmatter 누락 검사
- task id 정규화
- 현재 git HEAD 조회
- Codex CLI 후보 해석
- `tokens used` 출력 파싱
- retry 기반 파일 이동

## Boundary

공통 모듈은 low-level helper만 가진다. 아래 로직은 각 watcher에 남겨 둔다.

- 어떤 폴더를 감시할지
- 어떤 prompt로 Codex를 실행할지
- report와 alert를 어떤 형식으로 쓸지
- stale task 처리 정책
- cowork approval과 promotion 정책
- git automation과 Slack alert 정책

이 경계를 유지하면 공통 모듈이 workflow 정책까지 흡수하지 않아 변경 영향이 커지는 것을 막을 수 있다.

## Why Wrappers Still Exist

`watcher.py`의 `move_task_file()`과 `cowork_watcher.py`의 `move_file()`은 얇은 wrapper로 남겨 두었다.

이유는 두 가지다.

- 기존 테스트가 이 함수 이름을 직접 monkeypatch하고 있다
- 상위 watcher가 각자 retry 상수와 파일 정책을 넘겨 주는 구조를 유지할 수 있다

즉, 구현은 공유하지만 테스트와 호출 경계는 watcher 파일 기준으로 유지한다.

## Testing Notes

관련 회귀 검증은 아래 테스트가 담당한다.

- `tests/test_watcher.py`
- `tests/test_cowork_watcher.py`

특히 cowork 승격 테스트는 현재 실제 동작 기준을 따른다.

- promotion은 packet을 `move`하지 않고 `copy`한다
- stale review 판정은 review와 packet의 mtime 비교로 결정한다

## Update Rule

앞으로 watcher 공통 동작을 수정할 때는 먼저 이 문서를 갱신하는 편이 좋다.

특히 아래 항목이 바뀌면 반드시 문서도 같이 바꾼다.

- 공통 모듈의 책임 범위
- wrapper 유지 이유
- retry/lock/frontmatter 처리 방식
- 테스트가 전제하는 promotion 또는 stale 판정 규칙
