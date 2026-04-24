# 이소서 (Isoser) — CLAUDE.md

## 이 문서의 역할

- 이 문서는 Claude가 이 저장소에 들어왔을 때 빠르게 방향을 잡기 위한 상위 요약 문서다.
- 현재 동작의 runtime truth는 항상 `AGENTS.md`, `docs/agent-playbook.md`, `docs/current-state.md`를 우선한다.
- Claude의 기본 역할은 기획과 명세 작성이다. 구현 프롬프트를 길게 쓰기보다, 합의된 변경을 단일 markdown task packet으로 정리해 Codex 또는 원격 fallback 경로로 넘긴다.
- packet 규칙의 원본은 `docs/rules/claude-project-instructions.md`, 템플릿은 `docs/rules/task-packet-template.md`를 따른다.

## 에이전트 시작 순서

1. `AGENTS.md`
2. `docs/agent-playbook.md`
3. 현재 작업 packet
   - `cowork/packets/<task-id>.md`
   - `tasks/inbox/<task-id>.md`
   - `tasks/remote/<task-id>.md`
4. `docs/current-state.md`
5. 필요 시 폴더별 추가 규칙 문서
6. 관련 `reports/*.md`, `docs/refactoring-log.md`

핵심 원칙:

- packet만 믿고 구현 방향을 고정하지 않는다.
- 현재 코드와 `docs/current-state.md`를 먼저 대조한다.
- 이미 있는 구현이 있으면 재사용하고, 최소 안전 변경을 우선한다.
- 직접 대화 작업과 queued task packet 작업을 혼동하지 않는다.

## Claude 대화 규칙

- 코드 작업 새 대화의 첫 응답은 아래 순서를 따른다.
  - 작업 이해
  - 현재 목표
  - 확인한 가정
  - 추천 진행 순서
  - 바로 시작할 액션
- 사용자가 `세션 시작` 또는 `세션시작`이라고 말하면 `docs/rules/session-start-template.md` 형식으로 응답한다.
- 사용자가 `작업 끝`이라고 말하면 `docs/rules/refactoring-log-template.md` 형식으로 markdown 요약을 작성한다.
- 변경 제안에는 항상 아래 항목을 포함한다.
  - 변경 이유
  - 영향 범위
  - 리스크
  - 테스트 포인트
  - 추가 리팩토링 후보
- 기존 동작 유지가 최우선이다.
- 큰 리팩토링보다 점진적 개선을 우선한다.
- 불확실한 내용은 반드시 `추정`이라고 명시한다.

## 작업 모드

### 1. Claude planning / queued task packet work

- Claude는 기본적으로 구현 대신 task packet을 만든다.
- 출력은 설명 전후 문장 없이 markdown 문서 1개만 내보내는 것을 기본으로 한다.
- required frontmatter:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- 필요 시 안정성 필드도 함께 넣는다.
  - `planned_files`
  - `planned_worktree_fingerprint`
- narrow scope packet이나 dirty worktree 의존 packet은 fingerprint를 붙이는 편이 안전하다.
- packet 저장 경로:
  - 로컬 실행: `tasks/inbox/<task-id>.md`
  - 원격 fallback: `tasks/remote/<task-id>.md`

### 2. Direct Codex conversation work

- 사용자가 Codex 채팅에서 직접 구현/수정/진단을 요청하는 경로는 execution queue packet 작업과 별개다.
- 직접 대화 작업은 frontmatter 누락만으로 차단하지 않는다.
- 직접 대화 작업에서는 사용자가 명시적으로 원하지 않는 한 `tasks/`나 `cowork/packets/`에 새 파일을 만들거나 이동하지 않는다.
- 그래도 현재 코드, `docs/current-state.md`, 기존 구현, 최근 report/log를 먼저 확인하는 원칙은 동일하다.

## 현재 제품/운영 상태 (2026-04-24)

### 공개 사용자 흐름

- `/`는 기본 공개 랜딩인 `/landing-c`로 redirect 된다.
- 공개 랜딩은 `landing-a`, `landing-b`, `landing-c` 3개 변형이 유지되고 있다.
- 공개 프로그램 축은 `/programs`, `/programs/[id]`, `/compare`가 핵심이다.
- 비교 선택 모달의 전체 검색은 가벼운 compare-search BFF를 통해 summary payload를 받는다.

### 대시보드 흐름

- `/dashboard`는 현재 `찜한 훈련`과 `AI 맞춤 취업 지원 캘린더`를 중심으로 동작한다.
- 추천 카드에서 선택한 일정은 `calendar_program_selections` 서버 저장을 우선 쓰고, 실패 시 브라우저 fallback을 유지한다.
- 프로필, 활동, 이력서, 자기소개서, 문서 저장소, 포트폴리오 화면은 모두 실사용 경로다.
- `/dashboard/portfolio`는 더 이상 단순 스캐폴드가 아니라 활동 기반 포트폴리오 초안 생성, 저장된 초안 재열기, 인쇄 기반 PDF 저장 흐름을 가진다.
- `/dashboard/coach`는 아직 `준비 중` 스캐폴드다.

### 프로그램 축 현재 상태

- 프로그램 목록의 주 읽기 경로는 점진적으로 `program_list_index` read-model 중심으로 옮겨가고 있다.
- `GET /programs/list`는 `items`와 `promoted_items`를 분리해 내려준다.
- 인기순과 상세 유입 추적은 `detail_view_count`, `detail_view_count_7d`, `click_hotness_score` read-model 컬럼을 활용한다.
- dashboard bookmark/calendar selection BFF는 `program_list_index` summary read를 우선 사용하고, 필요할 때만 legacy `programs`로 fallback 한다.
- 추천/캘린더 추천/비교 관련도는 additive `user_recommendation_profile`을 우선 읽고, 없을 때 legacy profile로 fallback 한다.

### 현재 리팩토링 포커스

- `docs/specs/final-refactor-migration-roadmap-v1.md` 기준 현재 구현 중심 패키지는 `패키지 4: read switch`다.
- `패키지 3`의 dual write seed는 저장소 기준으로 완료된 상태다.
- 프로그램 축을 건드릴 때는 아래 전환용 계약과 helper를 우선 재사용한다.
  - `ProgramCardSummary`
  - `ProgramListRowItem`
  - `ProgramCardItem`
  - `ProgramSelectSummary`
  - `frontend/lib/program-display.ts`
  - `frontend/lib/program-card-items.ts`
  - `frontend/lib/server/program-card-summary.ts`
- 리팩토링 중에도 공개 API와 현재 화면 동작은 최대한 유지한다.

## 핵심 구조

### frontend

- `frontend/app/api/**`는 브라우저가 직접 호출하는 BFF 레이어다.
- 프로그램 화면은 `(landing)` route group 아래에 모여 있다.
- 대시보드 추천 상태와 캘린더 적용 흐름은 `frontend/app/dashboard/_hooks/use-dashboard-recommendations.ts`가 중심이다.
- 프로그램 표시 공통 로직은 아래 파일에 모여 있다.
  - `frontend/lib/program-display.ts`
  - `frontend/lib/program-card-items.ts`
  - `frontend/lib/server/program-card-summary.ts`
  - `frontend/lib/types/index.ts`

### backend

- FastAPI 진입점은 `backend/main.py`다.
- 프로그램 축 핵심 라우터는 `backend/routers/programs.py`다.
- 추천/collector/read-model 관련 구현은 `backend/rag/` 하위에 있다.
- 관리자 프로그램 sync는 `backend/routers/admin.py`가 담당한다.

### automation

- `cowork/packets/`: 사람이 계속 수정하는 원본 packet
- `cowork/reviews/`: cowork watcher가 만든 review 결과
- `tasks/inbox/`: 승인된 최신 packet의 로컬 실행 큐
- `tasks/remote/`: 승인된 최신 packet의 원격 fallback 큐
- `tasks/review-required/`: verifier가 사람 검토를 요구한 살아 있는 실행 큐
- `dispatch/alerts/`: local watcher 최종 상태 알림
- `reports/`: result, drift, blocked, verification 등 감사용 산출물
- `watcher.py`: 로컬 실행 watcher
- `cowork_watcher.py`: packet review/promotion watcher

## 주요 백엔드 엔드포인트

### 문서/AI

- `POST /parse/pdf`
- `POST /assistant/message`
- `POST /coach/feedback`
- `GET /coach/sessions`
- `GET /coach/sessions/{session_id}`
- `POST /match/analyze`
- `POST /match/rewrite`
- `POST /match/extract-job-image`
- `POST /match/extract-job-pdf`
- `POST /activities/convert`
- `POST /company/insight`
- `GET /skills/suggest`

### 프로그램

- `GET /programs`
- `GET /programs/list`
- `GET /programs/facets`
- `GET /programs/count`
- `GET /programs/filter-options`
- `GET /programs/popular`
- `POST /programs/batch`
- `POST /programs/details/batch`
- `GET /programs/{program_id}`
- `GET /programs/{program_id}/detail`
- `POST /programs/{program_id}/detail-view`
- `POST /programs/recommend`
- `GET /programs/recommend/calendar`
- `POST /programs/compare-relevance`
- `POST /programs/sync`

### 사용자/운영

- `GET /bookmarks`
- `POST /bookmarks/{program_id}`
- `DELETE /bookmarks/{program_id}`
- `POST /admin/sync/programs`
- `POST /slack/commands/cowork-approve`
- `POST /slack/interactivity/cowork-review`

## 주요 화면 상태

- `/landing-a`: 공개 랜딩 유지
- `/landing-b`: 실험/보존용 공개 랜딩
- `/landing-c`: 현재 기본 공개 랜딩
- `/programs`: 공개 프로그램 탐색
- `/programs/[id]`: 공개 프로그램 상세
- `/compare`: 공개 프로그램 비교
- `/login`: Google OAuth 로그인
- `/onboarding`: 신규 사용자 초기 프로필 저장
- `/dashboard`: 북마크 + 추천 캘린더 허브
- `/dashboard/profile`: 프로필 편집
- `/dashboard/activities`: 활동 저장소
- `/dashboard/activities/[id]`: 활동 상세 + AI 코치
- `/dashboard/match`: 공고 분석/이력
- `/dashboard/resume`: 이력서 빌더
- `/dashboard/resume/export`: PDF 내보내기
- `/dashboard/cover-letter`: 자기소개서 저장소
- `/dashboard/documents`: 저장 문서 목록
- `/dashboard/portfolio`: 포트폴리오 초안 생성/미리보기
- `/dashboard/coach`: 스캐폴드
- `/preview`, `/preview/assistant`: 프리뷰 경로

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.10 |
| DB/Auth/Storage | Supabase |
| AI | Gemini 계열 모델, LangChain, LangGraph |
| Vector DB | ChromaDB |
| Deploy | Vercel (frontend), Render (backend) |

## 자동화 흐름

### cowork review -> local execution

```text
Claude에서 packet 작성
-> cowork/packets/<task-id>.md 저장
-> cowork_watcher.py가 review 생성
-> cowork/reviews/<task-id>-review.md 검토
-> 필요 시 packet 원본 수정
-> 승인 후 최신 packet을 tasks/inbox/<task-id>.md로 복사
-> watcher.py 감지
-> tasks/running 이동
-> supervisor handoff / implement / verify
-> 결과에 따라 done | blocked | drifted | review-required
```

### remote fallback

```text
로컬 watcher를 쓸 수 없을 때
-> 승인된 최신 packet을 tasks/remote/<task-id>.md로 push
-> .github/workflows/claude-dev.yml 실행
-> 원격 Claude Code가 fallback 구현
```

## 문서 바로가기

- `AGENTS.md`: 저장소 전역 개발 규칙
- `docs/agent-playbook.md`: 문서 읽기 순서와 우선순위
- `docs/current-state.md`: 현재 동작의 runtime truth
- `docs/refactoring-log.md`: 변경 이력
- `docs/codex-workflow.md`: Codex/Claude 운영 문서
- `docs/automation/README.md`: 자동화 문서 인덱스
- `docs/rules/claude-project-instructions.md`: Claude packet 출력 규칙
- `docs/rules/task-packet-template.md`: packet 템플릿
- `docs/rules/session-start-template.md`: 세션 시작 응답 템플릿
- `docs/rules/refactoring-log-template.md`: 작업 끝 요약 템플릿
- `docs/specs/final-refactor-migration-roadmap-v1.md`: 현재 패키지형 리팩토링 로드맵

## 주의할 현재 사실

- `CLAUDE.md`는 요약 문서다. 실제 현재 상태 확인은 항상 `docs/current-state.md`에서 다시 한다.
- 브라우저 데이터 접근은 기본적으로 `frontend/app/api/**` BFF를 경유한다.
- 프로그램 축은 monolithic `Program`에서 surface-specific summary type으로 점진 전환 중이다.
- 직접 대화 구현 요청과 queue packet 작업은 분리해서 판단한다.
- 작업 종료 전에는 `git status --short --branch`를 다시 확인하는 습관을 유지한다.
