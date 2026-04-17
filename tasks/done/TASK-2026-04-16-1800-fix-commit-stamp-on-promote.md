---
id: TASK-2026-04-16-1800-fix-commit-stamp-on-promote
status: queued
type: bugfix
title: "cowork_watcher 승격 시 TODO_CURRENT_HEAD를 실제 HEAD SHA로 치환"
planned_at: 2026-04-16T18:00:00+09:00
planned_against_commit: 2aa310d1960e554268cd8b42b63d382f4f73415b
---

# Goal

`cowork_watcher.py`의 승격(promote) 단계에서, packet의 `planned_against_commit` 값이 `TODO_CURRENT_HEAD` 플레이스홀더인 경우 실제 `git rev-parse HEAD` 값으로 치환한다.

현재 모든 task가 Codex 실행 시 드리프트로 중단되는 원인이 이 버그이다.

# 원인 분석

1. Dispatch(Cowork)에서 packet을 생성할 때 git repo 접근이 불가능하여 `planned_against_commit: TODO_CURRENT_HEAD`로 작성
2. `cowork_watcher.py`의 review 단계(line 918-923)에서 commit drift를 감지하고 경고 출력하지만, 값을 치환하지는 않음
3. 승격 단계(line 1086)에서 `copy_file`로 packet을 `tasks/inbox/`에 그대로 복사
4. `watcher.py` → Codex 실행 시 `planned_against_commit`이 플레이스홀더이므로 AGENTS.md 규칙에 따라 drift report 작성 후 중단

# 작업 상세

## 수정 대상: `cowork_watcher.py`

### 1. stamp_commit_placeholder 함수 추가

`promoted_dispatch_path_for` 함수 근처(line 845 부근)에 다음 함수를 추가:

```python
def stamp_commit_placeholder(file_path: str) -> bool:
    """승격된 packet의 TODO_CURRENT_HEAD를 실제 HEAD SHA로 치환한다."""
    try:
        content = read_file(file_path)
        if "TODO_CURRENT_HEAD" not in content:
            return False
        head = current_head()
        if not head:
            return False
        stamped = content.replace("TODO_CURRENT_HEAD", head)
        write_file(file_path, stamped)
        return True
    except Exception:
        return False
```

- `read_file`, `write_file`은 기존 유틸 함수 사용 (없으면 open/write로 직접 처리)
- `current_head()`는 line 400에 이미 존재

### 2. 승격 흐름에 stamp 호출 삽입

`copy_file(packet_path, destination_path)` (line 1086) 직후에 호출:

```python
copy_file(packet_path, destination_path)
stamped = stamp_commit_placeholder(destination_path)  # 추가
```

### 3. dispatch 메시지에 stamp 결과 포함

승격 dispatch 메시지(line 1087-1100)에 stamp 여부를 기록:

```python
*([f"- commit_stamped: `{current_head()}`"] if stamped else []),
```

## 수정하지 않는 것

- `cowork/packets/` 원본 packet은 수정하지 않음 (원본 보존)
- review 단계의 경고 로직은 그대로 유지
- `watcher.py`는 수정 불필요 (이 수정으로 실제 SHA가 들어가므로 정상 작동)

# Acceptance Criteria

1. `cowork/packets/`에 `planned_against_commit: TODO_CURRENT_HEAD`인 packet을 승인하면, `tasks/inbox/`에 복사된 파일의 `planned_against_commit`이 실제 40자 SHA로 치환되어 있어야 한다
2. 이미 실제 SHA가 들어있는 packet은 변경 없이 그대로 복사되어야 한다
3. `cowork/packets/` 원본 파일은 수정되지 않아야 한다

# 검증 방법

1. `cowork/packets/`에 테스트용 packet 생성 (planned_against_commit: TODO_CURRENT_HEAD)
2. `.ok` approval 파일 생성
3. cowork_watcher가 승격 처리
4. `tasks/inbox/`의 packet에서 `planned_against_commit` 값이 실제 SHA인지 확인
5. `cowork/packets/` 원본이 변경되지 않았는지 확인

# 영향 범위

- 수정 파일: `cowork_watcher.py` (1개)
- 새 함수 1개, 기존 함수 1곳 수정
- 하위 호환성: 이미 실제 SHA가 있는 packet에는 영향 없음
