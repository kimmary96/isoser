# 이소서 (Isoser)

이소서는 공공 취업 지원 프로그램 탐색과 취업 문서 작성을 한 흐름으로 묶는 서비스입니다. 공개 프로그램 허브에서 관심 프로그램을 찾고, 저장한 활동 데이터와 AI 코치를 이용해 이력서·자기소개서·포트폴리오 초안을 빠르게 정리할 수 있습니다.

## 현재 개발 상태 (2026-04-20 기준)

### 구현 완료
- Google OAuth 로그인, Supabase 세션 기반 인증
- 이력서 PDF 업로드 후 프로필/활동 자동 추출 (`POST /parse/pdf`)
- 공개 랜딩/탐색 축
  - 메인 랜딩 `/landing-a`
  - 프로그램 탐색 `/programs`
  - 프로그램 비교 `/compare`
- 대시보드 프로필 편집
  - 이름, 희망 직무(`profiles.bio`), 이메일, 전화번호
  - 프로필 이미지 업로드
  - 포트폴리오 링크 저장(`profiles.portfolio_url`)
- 프로그램 허브
  - 검색, 카테고리/지역 필터, 모집중 기본 보기, 최근 마감 포함 토글
  - 프로그램 상세 조회
  - 북마크 (`GET/POST/DELETE /bookmarks`)
  - 추천 API (`POST /programs/recommend`, `GET /programs/recommend/calendar`)
  - 비교 적합도 API (`POST /programs/compare-relevance`)
- 활동 저장소
  - 활동 목록/상세/수정/삭제
  - STAR 항목 저장
  - STAR/포트폴리오 구조 변환 (`POST /activities/convert`)
  - AI 요약 생성 (`frontend/app/api/summary`)
- AI 코치
  - 활동 설명 기반 멀티턴 피드백 (`POST /coach/feedback`)
  - 세션 저장/복원 조회 (`GET /coach/sessions`, `GET /coach/sessions/{session_id}`)
- 공고 매칭 분석
  - 공고 전문 직접 입력
  - 이미지 OCR 기반 공고 텍스트 추출 (`POST /match/extract-job-image`)
  - PDF 공고 텍스트 추출 (`POST /match/extract-job-pdf`)
  - 활동/이력서 기준 매칭 분석 저장 (`POST /match/analyze`)
  - 기업 정보 요약 조회 (`POST /company/insight`)
- 이력서 편집/문서 저장소
  - 활동, 기술, 자기소개서 문항 선택 기반 이력서 생성
  - 문서 저장소에서 생성 이력서 조회
  - PDF 내보내기 (`/dashboard/resume/export`)
- 자기소개서 저장소
  - 목록 조회, 검색, 상세 편집, 문항(`qa_items`) 저장
- 포트폴리오
  - 활동 상세에서 포트폴리오 구조로 변환 후 `/dashboard/portfolio`에서 미리보기

### 현재 제약
- 포트폴리오는 변환 결과 미리보기 중심이며, 별도 저장/배포 워크플로우는 아직 약합니다.
- 이력서 템플릿 선택 UI는 있으나 실제 PDF 출력 포맷은 기본형 중심입니다.
- 이력서 편집 화면의 우측 AI 어시스턴트와 활동 상세 요약은 프론트 내부 Gemini 호출에 의존합니다.
- 게스트 모드는 제거되었으며 현재는 로그인 사용자 기준으로만 동작합니다.
- 광고 수익화, 스폰서드 슬롯, AI 검색 챗봇은 사업계획 단계이며 운영 기능으로는 아직 연결되지 않았습니다.
- 백엔드는 Python 3.10.x만 허용합니다. (`backend/check_python_version.py`)

## 주요 화면

- `/landing-a`: 공개 메인 랜딩
- `/landing-b`: 공개 랜딩 실험 보존 경로
- `/programs`: 공개 프로그램 탐색
- `/compare`: 공개 프로그램 비교
- `/login`: Google OAuth 로그인
- `/dashboard`: 추천/문서 워크스페이스
- `/onboarding`: 신규 사용자 초기 데이터 저장
- `/dashboard/activities`: 활동 저장소
- `/dashboard/activities/[id]`: 활동 상세, STAR 편집, AI 코치 진입
- `/dashboard/match`: 공고 분석, 기업 정보 요약, 분석 이력
- `/dashboard/resume`: 이력서 조립/생성
- `/dashboard/portfolio`: 활동 기반 포트폴리오 미리보기
- `/dashboard/documents`: 생성 이력서 목록
- `/dashboard/resume/export`: PDF 내보내기
- `/dashboard/cover-letter`: 자기소개서 저장소

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, LangChain, LangGraph, PyMuPDF |
| AI | Gemini 2.5 Flash(백엔드), Gemini 2.0 Flash(프론트 요약 API) |
| DB/Auth/Storage | Supabase |
| Vector DB | ChromaDB |
| Deploy | Vercel (frontend), Render (backend) |

## 폴더 구조

```text
isoser/
├── tasks/
│   ├── inbox/
│   ├── running/
│   ├── done/
│   ├── blocked/
│   ├── drifted/
│   └── remote/
├── dispatch/
│   └── alerts/
├── reports/
├── frontend/
│   ├── app/
│   └── lib/
├── backend/
│   ├── routers/
│   ├── chains/
│   ├── repositories/
│   └── rag/
├── supabase/
│   ├── migrations/
│   └── README.md
├── AGENTS.md
├── watcher.py
└── docs/
    ├── README.md
    ├── current-state.md
    ├── codex-workflow.md
    ├── refactoring-log.md
    ├── automation/
    ├── rules/
    ├── specs/
    ├── data/
    ├── research/
    └── worklogs/
```

## 자동화 흐름

이 저장소는 Claude와 Codex의 역할을 분리해서 운용합니다.

- Claude: 기획/명세 작성
- Codex: 로컬 구현 자동화
- Claude Code GitHub Action: 원격 fallback

### 큐와 문서의 역할

- `cowork/packets/`: 사람이 작성하고 수정하는 원본 task packet
- `cowork/reviews/`: 원본 packet review 결과 문서
- `tasks/inbox/`: 승인된 최신 packet 사본의 로컬 실행 큐
- `tasks/remote/`: 승인된 최신 packet 사본의 원격 fallback 큐
- `tasks/done/`, `tasks/blocked/`, `tasks/drifted/`: 실행 결과 상태 큐

### 로컬 기본 경로

```text
Claude에서 Task Packet 작성
-> cowork/packets/<task-id>.md 저장
-> cowork_watcher.py가 review 생성
-> cowork/reviews/<task-id>-review.md 확인
-> 필요 시 cowork/packets 원본 수정
-> 승인 후 최신 packet을 tasks/inbox/<task-id>.md로 복사
-> watcher.py 감지
-> tasks/running 이동
-> Codex가 AGENTS.md 기준으로 구현/검사/보고서 작성
-> drift/blocked/completed 상태를 dispatch/alerts/<task-id>-*.md로 기록
-> watcher가 성공 report 기준으로 task 관련 파일만 stage해서 [codex] 커밋 후 push 시도
-> tasks/done 이동

채널 구분:
- `cowork/dispatch/`: cowork packet review, stale-review, promoted 같은 scratch workflow 상태
- `dispatch/alerts/`: local watcher의 최종 실행 결과 (`completed`, `drift`, `blocked`, `push-failed`)
```

### 원격 fallback 경로

```text
PC가 꺼져 있거나 로컬 watcher를 못 쓰는 경우
-> cowork review/approval 이후 tasks/remote/<task-id>.md push
-> .github/workflows/claude-dev.yml 실행
-> Claude Code가 원격 구현 진행
```

### 관련 문서

- `AGENTS.md`: Codex 작업 규칙
- `docs/README.md`: docs 구조 인덱스
- `docs/current-state.md`: 현재 자동화/구조 상태
- `docs/codex-workflow.md`: Codex/Claude 운용 문서
- `docs/automation/README.md`: 자동화 운영 문서 인덱스
- `docs/rules/claude-project-instructions.md`: Claude 프로젝트 instructions 원본
- `docs/rules/task-packet-template.md`: 표준 Task Packet 템플릿

참고:
- `cowork/`는 현재 review와 promotion을 위한 scratch workspace로 사용합니다.
- `tasks/`만 execution queue입니다.
- `tasks/inbox/`로 들어가는 것은 review 문서가 아니라 승인된 최신 packet 사본입니다.

### 로컬 watcher 실행

Windows PowerShell 기준:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1
```

재시작이 필요할 때는 `docs/rules/watcher-restart-checklist.md`를 참고합니다.

Slack으로 watcher alert를 받고 싶으면 루트에 `.watcher.env`를 만들고 webhook 값을 넣습니다.

```powershell
Copy-Item .watcher.env.example .watcher.env
# Then edit .watcher.env and set the real webhook URL.
powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1
```

`.watcher.env`는 git ignore 대상이라 로컬 값이 커밋되지 않습니다.

## 로컬 실행

### 1) 환경변수 준비

```bash
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

### 2) 백엔드 실행

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python rag/seed.py
uvicorn main:app --reload --port 8000
```

### 3) 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

기본 접속 주소
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## 환경변수

### `frontend/.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### `backend/.env`

```bash
GOOGLE_API_KEY=your_gemini_api_key
CHROMA_PERSIST_DIR=./chroma_store_v2
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 헬스체크 |
| GET | `/health` | 앱 상태 + Chroma 상태 |
| POST | `/parse/pdf` | 이력서 PDF 구조화 |
| POST | `/coach/feedback` | 활동 기반 AI 코치 피드백 |
| GET | `/coach/sessions` | 사용자 코치 세션 목록 |
| GET | `/coach/sessions/{session_id}` | 코치 세션 상세 |
| POST | `/activities/convert` | 활동 STAR/포트폴리오 구조 변환 |
| POST | `/match/analyze` | 공고 매칭 분석 |
| POST | `/match/rewrite` | 공고 기반 리라이팅 |
| POST | `/match/extract-job-image` | 공고 이미지 텍스트 추출 |
| POST | `/match/extract-job-pdf` | 공고 PDF 텍스트 추출 |
| POST | `/company/insight` | 기업 정보 요약 |
| GET | `/programs` | 프로그램 목록 조회 |
| GET | `/programs/popular` | 랜딩용 인기 프로그램 조회 |
| GET | `/programs/count` | 조건별 프로그램 수 조회 |
| GET | `/programs/{program_id}` | 프로그램 상세 조회 |
| POST | `/programs/recommend` | 사용자 맞춤 추천 |
| GET | `/programs/recommend/calendar` | 캘린더용 추천 |
| POST | `/programs/compare-relevance` | 비교 화면용 AI 적합도 계산 |
| GET | `/bookmarks` | 북마크 목록 |
| POST | `/bookmarks/{program_id}` | 북마크 추가 |
| DELETE | `/bookmarks/{program_id}` | 북마크 삭제 |

## Supabase 스키마

주요 테이블
- `profiles`
- `activities`
- `resumes`
- `coach_sessions`
- `match_analyses`
- `cover_letters`
- `programs`
- `program_bookmarks`
- `portfolios`

주요 스토리지 버킷
- `activity-images`

마이그레이션은 `supabase/migrations` 기준으로 관리합니다.

## 배포 메모

### Frontend (Vercel)
- Root Directory: `frontend`
- 필수 환경변수
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_BACKEND_URL`
  - 선택: `NEXT_PUBLIC_SITE_URL`

### Backend (Render)
- Root Directory: `backend`
- 필수 환경변수
  - `GOOGLE_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CHROMA_PERSIST_DIR`
- 시작 전에 `python rag/seed.py` 실행이 필요합니다.

## 인증 설정 문서

- 로컬 Supabase OAuth/Auth 설정: `docs/auth/supabase-auth-local.md`
- 운영 Supabase OAuth/Auth 설정: `docs/auth/supabase-auth-production.md`
