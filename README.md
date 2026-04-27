# 이소서 (Isoser)

이소서는 공공 취업 지원 프로그램 탐색과 취업 문서 작성을 한 흐름으로 묶는 서비스입니다. 공개 프로그램 허브에서 프로그램을 찾고 비교한 뒤, 저장한 활동 데이터와 AI 코치를 이용해 이력서, 자기소개서, 포트폴리오 초안을 빠르게 정리할 수 있습니다.

## 현재 개발 상태 (2026-04-24 기준)

### 현재 제공 중인 흐름

- 공개 진입점은 `/`이며 현재 기본 공개 랜딩은 `/landing-c`입니다.
- 공개 랜딩 축은 `/landing-a`, `/landing-b`, `/landing-c`, `/programs`, `/compare`로 운영합니다.
- 로그인 후 대시보드는 `찜한 훈련`, `AI 맞춤 취업 지원 캘린더`, 프로필, 활동, 이력서, 자기소개서, 포트폴리오 초안 흐름을 제공합니다.
- 프로그램 상세 진입은 `detail-view` 집계를 남기고, 인기/추천 정렬은 점진적으로 `program_list_index` read-model을 우선 사용합니다.
- 추천/캘린더 추천/비교 관련도는 additive `user_recommendation_profile` 경로를 우선 읽고, migration이 아직 없는 환경에서는 legacy profile read로 fallback 합니다.

### 구현 완료

- Google OAuth 로그인, Supabase 세션 기반 인증
- 이력서 PDF 업로드 후 프로필/활동 자동 추출 (`POST /parse/pdf`)
- 공개 프로그램 허브
  - `/programs` 목록, 검색, 필터, 인기/마감 임박 정렬
  - `/programs/[id]` 상세, 북마크, 공유
  - `/compare` 프로그램 비교와 관련도 비교
- 대시보드
  - `찜한 훈련` 조회
  - `AI 맞춤 취업 지원 캘린더` 추천 및 일정 적용
  - 프로필 편집, 활동 저장소, 이력서 빌더, 자기소개서 저장소
  - 포트폴리오 초안 생성, 저장된 초안 재열기, 인쇄 기반 PDF 저장
- AI/문서 기능
  - 활동 기반 AI 코치와 세션 저장/복원
  - 공고 매칭 분석, 이미지 OCR/PDF 추출, 기업 정보 요약
  - 활동 STAR/포트폴리오 구조 변환
- 운영 자동화
  - cowork packet review/promotion
  - local watcher 기반 Codex 실행
  - GitHub Action 기반 remote fallback

### 현재 포커스

- 프로그램 축 `패키지 4: read switch` 진행 중
- `program_list_index`, `ProgramCardItem`, `ProgramListRowItem` 중심으로 read 경로를 점진 전환 중
- `user_recommendation_profile` additive schema와 기존 추천 경로를 함께 유지하는 과도기 정리 중

### 현재 제약

- `/dashboard/coach`는 아직 `준비 중` 스캐폴드입니다.
- 프로그램 축은 monolithic `Program`에서 surface-specific summary type으로 전환 중이라, 일부 경로는 transition fallback을 유지합니다.
- additive migration이 아직 적용되지 않은 환경에서도 동작해야 해서 backend/BFF에 best-effort fallback 로직이 남아 있습니다.
- 백엔드는 Python `3.10.14` 기준으로 맞추는 것이 안전합니다. (`backend/runtime.txt`)

## 주요 화면

- `/`: `/landing-c`로 redirect
- `/landing-a`: 공개 랜딩 A
- `/landing-b`: 공개 랜딩 실험/보존 경로
- `/landing-c`: 현재 기본 공개 랜딩
- `/programs`: 공개 프로그램 탐색
- `/programs/[id]`: 공개 프로그램 상세
- `/compare`: 공개 프로그램 비교
- `/login`: Google OAuth 로그인
- `/onboarding`: 신규 사용자 초기 프로필 설정
- `/dashboard`: 북마크 + 추천 캘린더 허브
- `/dashboard/profile`: 프로필 편집
- `/dashboard/activities`: 활동 저장소
- `/dashboard/activities/[id]`: 활동 상세 + AI 코치
- `/dashboard/match`: 공고 분석/기업 정보 요약/분석 이력
- `/dashboard/resume`: 이력서 빌더
- `/dashboard/resume/export`: PDF 내보내기
- `/dashboard/cover-letter`: 자기소개서 저장소
- `/dashboard/documents`: 저장 문서 목록
- `/dashboard/portfolio`: 포트폴리오 초안 생성/미리보기
- `/dashboard/coach`: 준비 중
- `/preview`, `/preview/assistant`: 프리뷰 경로

## 핵심 API

브라우저는 기본적으로 `frontend/app/api/**` BFF를 통해 데이터를 읽고 씁니다. 주요 backend API는 아래와 같습니다.

### 문서/AI

| Method | Path | 설명 |
|--------|------|------|
| POST | `/parse/pdf` | 이력서 PDF 구조화 |
| POST | `/assistant/message` | 어시스턴트 메시지 처리 |
| POST | `/coach/feedback` | 활동 기반 AI 코치 피드백 |
| GET | `/coach/sessions` | 사용자 코치 세션 목록 |
| GET | `/coach/sessions/{session_id}` | 코치 세션 상세 |
| POST | `/activities/convert` | 활동 STAR/포트폴리오 구조 변환 |
| POST | `/match/analyze` | 공고 매칭 분석 |
| POST | `/match/rewrite` | 공고 기반 리라이팅 |
| POST | `/match/extract-job-image` | 공고 이미지 텍스트 추출 |
| POST | `/match/extract-job-pdf` | 공고 PDF 텍스트 추출 |
| POST | `/company/insight` | 기업 정보 요약 |
| GET | `/skills/suggest` | 직무 기반 스킬 추천 |

### 프로그램

| Method | Path | 설명 |
|--------|------|------|
| GET | `/programs` | legacy flat 프로그램 목록 |
| GET | `/programs/list` | read-model 기반 목록 (`items`, `promoted_items`) |
| GET | `/programs/facets` | 프로그램 facet snapshot |
| GET | `/programs/count` | 조건별 프로그램 수 |
| GET | `/programs/filter-options` | 동적 필터 옵션 |
| GET | `/programs/popular` | 인기 프로그램 |
| POST | `/programs/batch` | 비교용 기본 프로그램 일괄 조회 |
| POST | `/programs/details/batch` | 비교용 상세 일괄 조회 |
| GET | `/programs/{program_id}` | 프로그램 기본 상세 |
| GET | `/programs/{program_id}/detail` | 상세 페이지용 정규화 상세 응답 |
| POST | `/programs/{program_id}/detail-view` | 상세 진입 집계 기록 |
| POST | `/programs/recommend` | 사용자 맞춤 추천 |
| GET | `/programs/recommend/calendar` | 캘린더용 추천 |
| POST | `/programs/compare-relevance` | 비교 화면용 적합도 계산 |
| POST | `/programs/sync` | 프로그램 sync |

### 사용자/운영

| Method | Path | 설명 |
|--------|------|------|
| GET | `/bookmarks` | 북마크 목록 |
| POST | `/bookmarks/{program_id}` | 북마크 추가 |
| DELETE | `/bookmarks/{program_id}` | 북마크 삭제 |
| POST | `/admin/sync/programs` | 관리자 프로그램 sync |
| POST | `/slack/commands/cowork-approve` | Slack approval command |
| POST | `/slack/interactivity/cowork-review` | Slack cowork review interactivity |

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.10 |
| AI | Gemini 계열 모델, LangChain, LangGraph |
| DB/Auth/Storage | Supabase |
| Vector DB | ChromaDB |
| Deploy | Vercel (frontend), Render (backend) |

## 저장소 구조

```text
isoser/
├── frontend/                 # Next.js 앱, BFF, 공개 랜딩/대시보드
├── backend/                  # FastAPI, AI chains, collector, routers
├── supabase/                 # migrations, DB 문서
├── cowork/                   # task packet 원본과 review workspace
├── tasks/                    # execution queue (inbox/running/done/...)
├── dispatch/                 # watcher alert 산출물
├── reports/                  # result, drift, blocked, verification 기록
├── scripts/                  # watcher/ops/diagnostic CLI
├── tests/                    # watcher 및 상위 테스트
├── docs/                     # 운영 truth, 규칙, specs, worklogs
├── AGENTS.md                 # 저장소 전역 개발 규칙
├── CLAUDE.md                 # Claude용 상위 요약 문서
├── watcher.py                # local execution watcher
└── cowork_watcher.py         # cowork review/promotion watcher
```

## 자동화 흐름

이 저장소는 planning과 implementation을 분리해서 운영합니다.

- Claude: 기획/명세/task packet 작성
- Codex: 로컬 구현 자동화
- GitHub Action 기반 Claude Code: 원격 fallback

### queued task packet 흐름

```text
Claude에서 packet 작성
-> cowork/packets/<task-id>.md 저장
-> cowork_watcher.py가 review 생성
-> cowork/reviews/<task-id>-review.md 검토
-> 승인 후 최신 packet을 tasks/inbox/<task-id>.md 또는 tasks/remote/<task-id>.md로 복사
-> watcher.py 또는 remote workflow가 구현 실행
-> 결과에 따라 done | blocked | drifted | review-required
```

### direct Codex conversation 흐름

- 사용자가 Codex 채팅에서 직접 작업을 요청한 경우에는 execution queue packet과 별도로 처리합니다.
- 이 경우에도 현재 코드, `docs/current-state.md`, 최근 `reports/`와 `docs/refactoring-log.md`를 먼저 확인합니다.
- 사용자가 명시적으로 원하지 않는 한 `tasks/`나 `cowork/packets/`에 새 큐 파일을 만들지 않습니다.

### 참고 문서

- `AGENTS.md`
- `CLAUDE.md`
- `docs/README.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `docs/codex-workflow.md`
- `docs/automation/README.md`
- `docs/rules/README.md`

## 로컬 실행

### 1. 환경변수 준비

```bash
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

Windows PowerShell에서는 아래처럼 복사해도 됩니다.

```powershell
Copy-Item frontend/.env.local.example frontend/.env.local
Copy-Item backend/.env.example backend/.env
```

### 2. 백엔드 실행

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

참고:

- backend runtime은 Python `3.10.x` 기준으로 맞추는 것이 안전합니다.
- seeded Chroma 컬렉션이 꼭 필요하면 `python rag/seed.py`를 별도로 실행합니다.
- `CHROMA_MODE=ephemeral` 환경에서는 startup seed를 건너뛸 수 있습니다.

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

기본 접속 주소:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`

### 4. watcher 실행

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1
```

재시작 전 점검은 `docs/rules/watcher-restart-checklist.md`를 참고합니다.

## 환경변수

전체 예시는 아래 파일을 우선 참고합니다.

- `frontend/.env.local.example`
- `backend/.env.example`

### frontend 핵심 값

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

### backend 핵심 값

```bash
GOOGLE_API_KEY=your_google_ai_studio_api_key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_SECRET_KEY=generate_a_random_secret_for_admin_routes
WORK24_TRAINING_AUTH_KEY=your_work24_training_auth_key
WORK24_OPEN_API_AUTH_KEY=your_work24_open_api_auth_key
```

추가 collector, Slack, fallback key, timeout 설정은 `backend/.env.example`에 정리돼 있습니다.

## 배포 메모

### Frontend (Vercel)

- Root Directory: `frontend`
- 주요 환경변수
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_BACKEND_URL`
  - 선택: `NEXT_PUBLIC_SITE_URL`

### Backend (Render)

- Root Directory: `backend`
- 주요 환경변수
  - `GOOGLE_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ADMIN_SECRET_KEY`
  - `WORK24_TRAINING_AUTH_KEY`
  - 필요 시 `WORK24_OPEN_API_AUTH_KEY`, `SLACK_SIGNING_SECRET` 등

## 인증/참고 문서

- 로컬 Supabase OAuth/Auth 설정: `docs/auth/supabase-auth-local.md`
- 운영 Supabase OAuth/Auth 설정: `docs/auth/supabase-auth-production.md`
- 현재 동작의 runtime truth: `docs/current-state.md`
- 변경 이력: `docs/refactoring-log.md`
