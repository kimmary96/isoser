# Agent Playbook

이 문서는 이 저장소에서 작업하는 에이전트의 **단일 진입점**이다.

목표:

- 새 에이전트가 어디를 먼저 읽어야 하는지 바로 알 수 있게 한다.
- 기획 규칙, 개발 규칙, 운영 규칙의 우선순위를 명확히 한다.
- task packet 기반 작업에서 planner / reviewer / implementer가 같은 기준을 보게 한다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `AGENTS.md`
2. 현재 작업 packet
   - `cowork/packets/<task-id>.md`
   - 또는 `tasks/inbox/<task-id>.md`
3. `docs/current-state.md`
4. 필요하면 폴더별 추가 규칙
   - 예: `cowork/FOLDER_INSTRUCTIONS.md`
5. 관련 `reports/*.md`, `docs/refactoring-log.md`

## Rule Priority

문서 간 기준이 충돌하면 아래 우선순위를 따른다.

1. `AGENTS.md`
   - 저장소 전역 개발 규칙
   - 필수 frontmatter, drift/duplicate 검사, 보고서 규칙
2. 폴더별 규칙 문서
   - 예: `cowork/FOLDER_INSTRUCTIONS.md`
   - 해당 폴더 안에서만 추가로 적용
3. 현재 task packet
   - 이번 작업의 목표, scope, acceptance, constraints, non-goals
4. `docs/current-state.md`
   - 현재 동작 중인 시스템의 사실상 운영 기준
5. `reports/*.md`, `docs/refactoring-log.md`
   - 과거 판단 근거와 변경 이력

중요:

- packet이 현재 코드와 어긋날 수 있으므로, packet만 믿고 구현하지 않는다.
- `docs/current-state.md`는 “지금 실제로 구현된 상태”를 확인하는 문서다.
- 과거 `docs/refactoring-log.md`는 참고용이지, 현재 truth를 대신하지 않는다.

## Document Map

### 1. Planning Rules

- `cowork/packets/*.md`
  - 기획 원본
  - 목표, scope, acceptance, constraints, non-goals
- `docs/specs/*`
  - 큰 제품/서비스 기획

### 2. Development Rules

- `AGENTS.md`
  - 저장소 전역 개발 규칙의 최상위 문서
- `docs/automation/task-packets.md`
  - task packet contract
- `docs/automation/local-flow.md`
  - local watcher 실행 흐름
- `docs/automation/overview.md`
  - watcher / cowork watcher 구조 개요
- `docs/automation/operations.md`
  - 운영 중 주의사항

### 3. Runtime Truth

- `docs/current-state.md`
  - 현재 시스템 동작 기준
- `reports/*.md`
  - blocked, drift, duplicate, result 판단 근거
- `docs/refactoring-log.md`
  - 변경 이력 로그

## Role Checklists

### Planner

해야 할 일:

1. 현재 관련 코드와 `docs/current-state.md`를 먼저 확인한다.
2. 새 task를 greenfield로 가정하지 않는다.
3. packet frontmatter 필수 필드를 채운다.
4. scope, acceptance, constraints, non-goals를 명확히 적는다.
5. 현재 코드와 다르면 drift risk를 packet에 반영한다.

추천 문서:

- `AGENTS.md`
- `docs/automation/task-packets.md`
- `docs/current-state.md`

### Reviewer

해야 할 일:

1. packet을 끝까지 읽는다.
2. 현재 코드와 touched area를 직접 확인한다.
3. drift, ambiguity, duplicate risk를 본다.
4. acceptance가 실행 가능한 수준으로 구체적인지 확인한다.
5. 문서/테스트/계약이 빠졌으면 promotion 전 보완을 요구한다.

추천 문서:

- `AGENTS.md`
- 현재 packet
- `docs/current-state.md`
- 관련 `reports/*.md`

### Implementer

해야 할 일:

1. packet만 보지 말고 현재 코드를 먼저 확인한다.
2. existing implementation을 재사용한다.
3. 최소 안전 변경으로 구현한다.
4. touched area 기준 검증을 수행한다.
5. `reports/<task-id>-result.md`를 작성한다.
6. 구조나 동작이 바뀌면 `docs/current-state.md`를 갱신한다.
7. 핵심 변경은 `docs/refactoring-log.md`에 남긴다.

추천 문서:

- `AGENTS.md`
- 현재 packet
- `docs/current-state.md`
- 관련 `reports/*.md`

## Packet Workflow

1. planner가 `cowork/packets/<task-id>.md`를 만든다.
2. cowork watcher가 review를 생성한다.
3. reviewer가 packet 원본을 수정하거나 보강한다.
4. 승인되면 최신 packet 사본이 `tasks/inbox/` 또는 `tasks/remote/`로 승격된다.
5. local watcher가 구현/검증을 수행한다.
6. 완료 후 result report, current-state, refactoring-log를 갱신한다.

상세 규칙:

- `cowork/packets/`는 draft 원본이다.
- `cowork/reviews/`는 review 산출물이다.
- `tasks/`는 실제 execution queue다.

## What To Update After Code Changes

아래 중 하나라도 바뀌면 문서를 같이 갱신한다.

- 사용자에게 보이는 동작
- API contract
- watcher / cowork watcher 동작
- task packet workflow
- 폴더 의미나 운영 절차

보통 갱신 대상:

1. `docs/current-state.md`
2. `docs/refactoring-log.md`
3. 필요한 경우 `docs/automation/*.md`

## Fast Start

새 에이전트가 이 저장소에서 바로 작업하려면:

1. `AGENTS.md`를 읽는다.
2. 이 문서를 읽는다.
3. 현재 task packet을 읽는다.
4. `docs/current-state.md`를 읽는다.
5. touched area 코드를 직접 확인한다.

이 다섯 단계를 생략하면, packet drift나 기존 구현 재사용 기회를 놓치기 쉽다.
