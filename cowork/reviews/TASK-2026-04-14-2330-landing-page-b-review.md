# Review: TASK-2026-04-14-2330-landing-page-b

## Overall assessment

이 packet은 `cowork/packets/` 초안으로는 전반적으로 양호하다.

- 필수 frontmatter인 `id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`가 모두 포함되어 있다.
- Goal, User Flow, UI Requirements, Acceptance Criteria, Constraints, Non-goals, Edge Cases가 잘 정리되어 있다.
- 별도 경로 추가, 정적 데이터 사용, 기존 랜딩 미변경 같은 범위 통제가 명확하다.

다만 실행 전 승격 품질로 보려면 아래 사항을 보완하는 것이 좋다.

## Packet-specific findings

### 1. Mockup reference is missing from the repository

packet 본문은 `isoser-landing-B.html` 시안을 구현 기준으로 삼고 있지만, 현재 저장소에서는 해당 파일이 확인되지 않았다.

- 위험: Codex가 세부 레이아웃과 상호작용을 추정 구현할 가능성이 있다.
- 권장: 실제 HTML 파일 경로, 스크린샷 경로, 또는 참조 URL을 packet 안에 명시한다.

### 2. File paths should use real repository paths

본문은 `app/page.tsx`를 기준으로 설명하지만 실제 저장소 경로는 `frontend/app/page.tsx`이다.

- 위험: 실행 전 검토 시 혼동 가능
- 권장: 아래처럼 실제 경로로 고정한다.
  - existing file: `frontend/app/page.tsx`
  - new file: `frontend/app/landing-b/page.tsx`

### 3. Preview/blur rule should be made explicit

현재 문구는 “미리보기 리스트 2개 노출 + 나머지 blur 처리”와 “3번째/4번째 항목 blur 처리”가 함께 있어, 총 카드 개수와 blur 적용 범위가 완전히 고정되어 있지는 않다.

- 위험: 구현자마다 카드 렌더링 방식이 달라질 수 있다.
- 권장: 아래처럼 한 문장으로 고정한다.
  - “결과 화면에는 총 4개의 프로그램 카드를 렌더링하고, 1~2번째는 정상 노출, 3~4번째는 blur overlay 처리한다.”

### 4. planned_against_commit should be refreshed before promotion

현재 packet의 `planned_against_commit`은 `cc03ef1`이지만, 현재 HEAD는 더 앞서 있다.

- 판단: 이 task는 신규 경로 추가 성격이라 즉시 치명적 드리프트로 보이지는 않는다.
- 권장: `tasks/inbox/` 또는 `tasks/remote/`로 승격하기 전에 최신 커밋으로 갱신한다.

## Rule review

현재 `cowork/` 운영 규칙은 전반적으로 문제 없다.

- `cowork/`는 초안 작업공간
- `tasks/`는 실행 큐
- `docs/`와 기준 문서는 직접 수정 대상이 아님
- 승인 후에만 `tasks/inbox/` 또는 `tasks/remote/`로 승격

다만 아래 두 점은 문구 보완이 있으면 더 안전하다.

### 1. Reference document rule should be phrased more precisely

`CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/*.md`를 기준 문서로 취급하는 방향은 맞다.
다만 “절대 수정 금지”처럼 읽히면 실제 저장소 운영 규칙과 충돌할 수 있다.

- 더 정확한 표현:
  - “cowork 초안은 기준 문서를 직접 수정하지 않는다.”
  - “기준 문서 변경이 필요하면 `cowork/reviews/`에 제안하고, 실제 수정은 승인된 task packet을 통해 진행한다.”

### 2. Root fallback should be explicitly disallowed

이전 피드백에서 `cowork/packets/`가 없어서 프로젝트 루트에 저장했다는 우회가 있었다.
이 동작은 다시 발생하지 않도록 막는 편이 좋다.

- 추가 권장 규칙:
  - “`cowork/packets/`가 없더라도 packet draft를 프로젝트 루트에 저장하지 않는다.”
  - “필요하면 먼저 `cowork/` 구조를 만들거나 사용자에게 확인한다.”

## Recommendation

이 packet은 수정 후 승격 권장이다.

승격 전 최소 수정 사항:

1. 시안 참조물 위치 명시
2. 실제 저장소 경로(`frontend/...`) 기준으로 정정
3. 결과 카드 수와 blur 처리 규칙 한 문장으로 고정
4. `planned_against_commit` 최신화
