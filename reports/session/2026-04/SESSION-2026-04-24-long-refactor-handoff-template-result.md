# Refactoring Summary

## 작업 목적

- 장기 리팩토링 세션이 길어질 때 새 대화창으로 안전하게 handoff할 수 있는 공용 템플릿을 문서화한다.
- 컨텍스트가 많이 찬 상태에서도 현재 패키지를 잃지 않고 이어서 진행할 수 있게 한다.

## 리팩토링 전 문제점

- 세션이 길어질수록 새 대화창 시작 프롬프트를 매번 수동으로 다시 써야 했다.
- 상위 spec, 현재 패키지 단계, dirty worktree, 실제 진행 중 작업 1개가 프롬프트마다 빠지거나 흔들릴 수 있었다.
- 그 결과 패키지 완료보다 추가 리팩토링이 계속 붙는 흐름이 생길 위험이 있었다.

## 실제 변경 사항

### 파일별 변경

- `docs/rules/long-refactor-handoff-template.md`
  - 장기 리팩토링 handoff 전용 규칙과 표준 새 창 프롬프트 템플릿을 추가했다.
  - 컨텍스트가 대략 80% 이상 찼다고 판단되는 시점에 사용할 기준과 체크리스트를 함께 문서화했다.
- `docs/rules/README.md`
  - 새 규칙 문서를 목록에 추가했다.
- `docs/current-state.md`
  - 장기 리팩토링 세션에서 새 창 handoff 템플릿을 쓰는 운영 규칙을 현재 상태 문서에 반영했다.
- `docs/refactoring-log.md`
  - 이번 문서 작업을 로그에 남겼다.

### 상태관리/데이터 흐름 변경

- 런타임 코드 변경은 없다.
- 운영 흐름 측면에서는 “컨텍스트가 많이 찬 장기 리팩토링 세션”에 대해 새 창 handoff를 표준화했다.

### 중복 제거 / 구조 개선

- 매번 수동으로 handoff 프롬프트를 재작성하던 흐름을 템플릿화했다.
- 현재 패키지 번호, dirty worktree 주제, 이번 턴에서 끝낼 작업 1개를 반드시 적도록 강제해 범위 확장을 줄이는 방향으로 정리했다.

## 유지된 기존 동작

- 코드 런타임 동작은 바꾸지 않았다.
- watcher, backend, frontend, migration 동작은 그대로다.
- 기존 session-start 템플릿과 refactoring-log 템플릿도 유지했다.

## 영향 범위

- 직접 영향: `docs/rules/*`, 운영 handoff 절차, 새 대화창 시작 프롬프트 작성 방식
- 간접 영향: 장기 리팩토링 패키지 진행 방식, 문서 handoff 품질
- 회귀 가능성 포인트: 없음. 문서/운영 규칙 변경만 있다.

## 테스트 체크리스트

- 새 규칙 문서가 `docs/rules/README.md`에 노출되는지
- `docs/current-state.md`에 handoff 규칙이 반영됐는지
- 새 창 프롬프트에 현재 패키지 번호, dirty worktree, 작업 1개를 넣도록 안내하는지
- 자동 테스트는 없음

## 남은 과제

- 필요하면 이 템플릿을 watcher/agent automation과 연결해 반자동 생성까지 확장할 수 있다.
- 현재는 문서 규칙만 추가됐고, 실제 자동 생성 스크립트는 없다.

## 추가 리팩토링 후보

- 후보 1
  - handoff 템플릿을 패키지형 작업과 일반 장기 조사형 작업으로 나눠 2종으로 세분화
  - 우선순위: 중
- 후보 2
  - 현재 dirty worktree와 최근 refactoring-log를 읽어 새 창 프롬프트 초안을 자동 생성하는 helper 스크립트 추가
  - 우선순위: 중

## 다음 대화에서 바로 이어갈 프롬프트

```text
docs/rules/long-refactor-handoff-template.md를 기준으로,
현재 패키지 번호와 dirty worktree를 다시 확인한 뒤
새 대화창 handoff 프롬프트를 실제 현재 상태에 맞게 채워줘.
```
