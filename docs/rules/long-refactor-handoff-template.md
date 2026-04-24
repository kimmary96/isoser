# Long Refactor Handoff Template

장기 리팩토링이나 다중 패키지 작업을 한 세션에서 오래 이어가다 보면, 뒤로 갈수록 컨텍스트가 길어지고 실제 구현보다 handoff 품질이 더 중요해지는 시점이 온다.

이 문서는 그런 상황에서 **새 대화창으로 안전하게 넘기는 표준 프롬프트 템플릿**이다.

## 언제 이 템플릿을 쓰는가

아래 중 하나라도 해당하면 이 템플릿을 먼저 쓴다.

- 세션 컨텍스트가 대략 80% 이상 찼다고 판단될 때
- 같은 주제의 spec / migration / report / dirty worktree가 많이 쌓여, 새 창이 아니면 맥락 손실 위험이 커질 때
- 패키지 작업이 길어져 “지금 몇 단계인지 다시 판정”이 먼저 필요할 때
- 추가 리팩토링 제안이 계속 붙어 현재 패키지 완료보다 확장이 우세해질 때

중요:

- 이 템플릿의 목적은 “긴 맥락을 요약”하는 것이 아니라, **새 창이 현재 패키지부터 다시 정확히 이어서 끝낼 수 있게 하는 것**이다.
- 따라서 handoff 프롬프트에는 “상위 계약”, “현재 단계”, “dirty worktree”, “이번 턴에서 끝낼 범위”가 반드시 들어가야 한다.

## 핵심 원칙

1. 문서만 믿지 말고 실제 저장소 상태를 다시 읽게 한다.
2. `docs/refactoring-log.md`와 `git status --short --branch`를 roadmap보다 우선 근거로 삼게 한다.
3. 현재 패키지를 먼저 끝내고 다음 패키지로 넘어가게 한다.
4. 패키지 진행 중 필요한 리팩토링은 허용하지만, **현재 패키지 완료에 직접 필요한 것만** 하게 한다.
5. 선택 리팩토링과 범위 확장은 후보로만 남기게 한다.

## 새 창 handoff 전에 반드시 적을 것

- 현재 최상위 기준 문서 1개
- 반드시 같이 읽어야 하는 보조 문서 목록
- 실제 저장소 기준 현재 단계 판정
- 진행 중인 dirty worktree 요약
- 이번 새 창에서 끝낼 구체 작업 1개
- 하지 말아야 할 범위

## 표준 절차

1. 현재 세션에서 `git status --short --branch`를 확인한다.
2. `docs/refactoring-log.md`와 관련 spec 문서를 확인한다.
3. 실제로 어느 패키지까지 진행됐는지 다시 판정한다.
4. 현재 패키지를 끝내는 데 필요한 작업 1개만 고른다.
5. 아래 템플릿으로 새 대화창 프롬프트를 만든다.

## 새 대화창 프롬프트 템플릿

아래 블록을 복사해 새 대화창 첫 메시지로 사용한다.

```text
세션 시작

이 대화는 이전 장기 리팩토링 세션을 이어받는 작업이다.
반드시 한국어로만 설명하고, 비개발자도 이해할 수 있게 작성하라.

이번 handoff의 목적은 "현재 패키지를 끝까지 마무리하고, 그 다음 패키지로 안전하게 넘어가는 것"이다.

중요 원칙:
- 문서만 믿지 말고 실제 저장소 상태를 먼저 다시 확인하라.
- `git status --short --branch`와 `docs/refactoring-log.md`를 roadmap 상태표보다 우선 근거로 삼아라.
- 현재 패키지를 먼저 끝내고 다음 패키지로 넘어가라.
- 패키지 진행 중 필요한 리팩토링은 해도 되지만, 현재 패키지 완료에 직접 필요한 것만 하라.
- 선택 리팩토링, 범위 확장, 미관 정리는 구현하지 말고 후보로만 남겨라.
- 기존 dirty worktree를 되돌리거나 덮어쓰지 마라.

반드시 가장 먼저 아래 순서로 읽어라.

1. <repo>/AGENTS.md
2. <repo>/docs/agent-playbook.md
3. <repo>/docs/current-state.md
4. <repo>/docs/specs/<최상위-기준-문서>.md
5. <repo>/docs/specs/<핵심-보조-문서-1>.md
6. <repo>/docs/specs/<핵심-보조-문서-2>.md
7. <repo>/docs/specs/<핵심-보조-문서-3>.md
8. <repo>/docs/refactoring-log.md
9. <repo>/supabase/SQL.md
10. 필요 시 관련 migration / backend / frontend 파일

이미 고정된 상위 합의:
- <상위 계약 1>
- <상위 계약 2>
- <상위 계약 3>

현재 저장소 기준 추정 단계:
- <예: Phase 2 설계 완료 + Phase 3 seed 진행 중>

현재 진행 중 dirty worktree 주제:
- <예: dashboard recommendation/bookmark/calendar surface 전환>

이번 새 창에서 끝낼 패키지:
- <패키지 번호와 이름>

이번 턴에서 끝낼 구체 작업:
- <정확히 1개 작업>

이번 턴에서 하지 말 것:
- <범위 밖 항목 1>
- <범위 밖 항목 2>
- <범위 밖 항목 3>

새 창 첫 응답은 반드시 아래 순서로 시작하라.

- 작업 이해
- 현재 목표
- 확인한 가정
- 추천 진행 순서
- 바로 시작할 액션

그리고 바로 아래 작업을 수행하라.

1. `git status --short --branch` 실행
2. 현재 단계 재판정
3. 읽은 근거 파일 목록 정리
4. 이번 턴에서 끝낼 작업 1개 확정
5. 관련 파일 읽기
6. 구현
7. 테스트/검증
8. `docs/current-state.md`, `docs/refactoring-log.md`, 필요 시 `reports/SESSION-YYYY-MM-DD-...-result.md` 갱신
9. 다음 패키지와 남은 과제 보고

중요 출력 형식:
- 현재 단계 판정
- 이번 턴 목표
- 읽은 근거 파일
- 실제 작업
- 검증 결과
- 다음 패키지
```

## 이 저장소에서 기본으로 채우는 권장 값

현재 이 저장소의 장기 리팩토링에서는 아래 문서를 우선 넣는 편이 안전하다.

- 최상위 기준 문서:
  - `docs/specs/final-refactor-axis-map-v1.md`
- 핵심 보조 문서:
  - `docs/specs/program-surface-contract-v2.md`
  - `docs/specs/program-canonical-schema-design-v1.md`
  - `docs/specs/final-refactor-migration-roadmap-v1.md`
  - `docs/specs/serializer-api-bff-transition-plan-v1.md`
  - `docs/specs/user-recommendation-serializer-contract-v1.md`
- 진행 상태 확인 문서:
  - `docs/refactoring-log.md`
  - `docs/current-state.md`

## 패키지 진행 중 리팩토링 허용 규칙

### 해도 되는 것

- 현재 패키지 완료에 직접 필요한 helper 추출
- 중복 formatter 제거
- 새 serializer / adapter / mapper 도입
- 테스트 가능성을 높이는 작은 함수 분리
- 현재 패키지에서 반드시 필요한 타입 분리

### 지금 하지 말 것

- 다른 패키지까지 건너뛰는 구조 변경
- 현재 화면과 무관한 대규모 타입 정리
- 미관/스타일 통일 목적의 정리
- “나중에 좋을 것 같은” 선제 추상화

## 종료 전 체크리스트

- 새 창 프롬프트에 현재 패키지 번호가 들어갔는가
- 새 창 프롬프트에 dirty worktree 주제가 들어갔는가
- 새 창 프롬프트에 이번 턴에서 끝낼 작업이 1개로 좁혀졌는가
- 상위 계약 문서가 명시됐는가
- `git status`와 `docs/refactoring-log.md` 재확인 지시가 들어갔는가

## 주의사항

- “컨텍스트가 80% 이상”은 도구의 정밀 수치가 아니라 운영 판단 기준이다.
- 애매하면 늦게 넘기기보다 조금 일찍 handoff하는 편이 안전하다.
- handoff 프롬프트는 요약문이 아니라 **실행 시작점**이어야 한다.
