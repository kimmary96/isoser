# 이소서 (Isoser)

이소서는 기존 이력서 PDF에서 시작해 활동 데이터를 정리하고, AI 코치와 공고 매칭 분석을 통해 이력서와 자기소개서를 다듬는 취업 문서 편집 서비스입니다.

## 현재 개발 상태 (2026-04-10 기준)

### 구현 완료
- Google OAuth 로그인, Supabase 세션 기반 인증
- 이력서 PDF 업로드 후 프로필/활동 자동 추출 (`POST /parse/pdf`)
- 대시보드 프로필 편집
  - 이름, 희망 직무(`profiles.bio`), 이메일, 전화번호
  - 프로필 이미지 업로드
  - 포트폴리오 링크 저장(`profiles.portfolio_url`)
- 활동 저장소
  - 활동 목록/상세/수정/삭제
  - STAR 항목 저장
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

### 현재 제약
- 포트폴리오 전용 페이지(`/dashboard/portfolio`)는 아직 준비 중이며, 현재는 프로필의 링크 저장/열기만 지원합니다.
- 이력서 템플릿 선택 UI는 있으나 실제 PDF 출력 포맷은 기본형 중심입니다.
- 이력서 편집 화면의 우측 AI 어시스턴트와 활동 상세 요약은 프론트 내부 Gemini 호출에 의존합니다.
- 게스트 모드는 제거되었으며 현재는 로그인 사용자 기준으로만 동작합니다.
- 백엔드는 Python 3.10.x만 허용합니다. (`backend/check_python_version.py`)

## 주요 화면

- `/dashboard`: 프로필, 경력 카드, 스킬, 활동 요약
- `/dashboard/onboarding`: PDF 업로드 및 초기 데이터 저장
- `/dashboard/activities`: 활동 저장소
- `/dashboard/activities/[id]`: 활동 상세, STAR 편집, AI 코치 진입
- `/dashboard/match`: 공고 분석, 기업 정보 요약, 분석 이력
- `/dashboard/resume`: 이력서 조립/생성
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
    ├── current-state.md
    ├── codex-workflow.md
    ├── claude-project-instructions.md
    └── prd.md
```

## 자동화 흐름

이 저장소는 Claude와 Codex의 역할을 분리해서 운용합니다.

- Claude: 기획/명세 작성
- Codex: 로컬 구현 자동화
- Claude Code GitHub Action: 원격 fallback

### 로컬 기본 경로

```text
Claude에서 Task Packet 작성
-> tasks/inbox/<task-id>.md 저장
-> watcher.py 감지
-> tasks/running 이동
-> Codex가 AGENTS.md 기준으로 구현/검사/보고서 작성
-> drift/blocked/completed 상태를 dispatch/alerts/<task-id>-*.md로 기록
-> watcher가 성공 report 기준으로 task 관련 파일만 stage해서 [codex] 커밋 후 push 시도
-> tasks/done 이동
```

### 원격 fallback 경로

```text
PC가 꺼져 있거나 로컬 watcher를 못 쓰는 경우
-> tasks/remote/<task-id>.md push
-> .github/workflows/claude-dev.yml 실행
-> Claude Code가 원격 구현 진행
```

### 관련 문서

- `AGENTS.md`: Codex 작업 규칙
- `docs/current-state.md`: 현재 자동화/구조 상태
- `docs/codex-workflow.md`: Codex/Claude 운용 문서
- `docs/claude-project-instructions.md`: Claude 프로젝트 instructions 원본
- `docs/task-packet-template.md`: 표준 Task Packet 템플릿

참고:
- `cowork/`는 기본 워크플로 디렉터리가 아닙니다.
- 필요 시에만 사람이 직접 만들거나 임시로 사용합니다.
- 자동화나 에이전트가 VS Code 시작 시 `cowork/`를 만들도록 가정하지 않습니다.

### 로컬 watcher 실행

Windows PowerShell 기준:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_watcher.ps1
```

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
GEMINI_API_KEY=your_gemini_api_key
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
| POST | `/match/analyze` | 공고 매칭 분석 |
| POST | `/match/rewrite` | 공고 기반 리라이팅 |
| POST | `/match/extract-job-image` | 공고 이미지 텍스트 추출 |
| POST | `/match/extract-job-pdf` | 공고 PDF 텍스트 추출 |
| POST | `/company/insight` | 기업 정보 요약 |

## Supabase 스키마

주요 테이블
- `profiles`
- `activities`
- `resumes`
- `coach_sessions`
- `match_analyses`
- `cover_letters`
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
  - `GEMINI_API_KEY`

### Backend (Render)
- Root Directory: `backend`
- 필수 환경변수
  - `GOOGLE_API_KEY`
  - `CHROMA_PERSIST_DIR`
- 시작 전에 `python rag/seed.py` 실행이 필요합니다.
