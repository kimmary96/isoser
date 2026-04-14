# Repository Agent Rules

## Core behavior
- 작업 시작 전 반드시 현재 repo 상태를 먼저 확인한다.
- task packet의 가정이 현재 코드와 맞는지 먼저 비교한다.
- 기존 동작을 보존하는 최소한의 안전한 변경을 우선한다.
- 넓은 범위의 재작성은 task가 명시적으로 요청할 때만 허용한다.

## Task processing
task 파일을 받으면 이 순서로 처리한다.
1. task 파일 전체를 읽는다.
2. planned_against_commit과 현재 HEAD를 비교한다.
3. drift가 크면 reports/<task-id>-drift.md를 쓰고 중단한다.
4. drift가 허용 범위면 task를 구현한다.
5. 관련 검사를 실행한다.
6. reports/<task-id>-result.md에 결과를 쓴다.
7. 구조가 바뀌었으면 docs/current-state.md를 갱신한다.
8. 주요 변경 내용을 docs/refactoring-log.md에 추가한다.
9. git add, commit -m "[codex] <task-id> 구현 완료", push origin develop 순서로 실행한다.

## Tech stack
- Frontend: Next.js 15, TypeScript, Tailwind CSS, Pretendard
- Backend: FastAPI, Python 3.10
- DB: Supabase (PostgreSQL)
- AI: Gemini 2.5 Flash

## Coding standards
- TypeScript strict 유지, any 사용 금지
- 기존 패턴 재사용 우선, 새 패턴 도입 최소화
- 중복 로직 발견 시 보고서에 명시

## Reporting
결과 보고서에는 반드시 포함한다.
- 변경된 파일 목록
- 변경 이유
- 보존된 기존 동작
- 위험 요소 및 회귀 가능성
- 후속 리팩토링 후보
