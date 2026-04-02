# 이소서 (Isoser)

AI 코치 기반 이력서/경력기술서 편집 서비스입니다.  
"AI가 대신 작성"이 아니라, 사용자가 직접 고칠 수 있도록 STAR 기준 피드백을 제공하는 데 초점을 둡니다.

## 개발 상태 (2026-04-02 기준)

### 구현 완료
- Google OAuth 로그인 + 게스트 모드 진입
- 이력서 PDF 업로드 후 프로필/활동 자동 추출 (`/parse/pdf`)
- 대시보드에서 프로필 확장 정보(경력/학력/수상/자격/외국어/스킬/자기소개) 편집 및 저장
- 활동 목록/상세 조회, 활동 설명 수정
- 활동 상세에서 STAR 기반 AI 코치 멀티턴 피드백 (`/coach/feedback`)
- 채용 공고 매칭 분석 + 점수 산식 상세 표시 (`/match/analyze`)
- 선택 활동 기반 이력서 생성 및 PDF 다운로드
- ChromaDB 기반 RAG 시드/조회 (장애 시 fallback 동작)

### 현재 제약/미구현
- 이력서 PDF 템플릿은 `simple` 1종만 제공
- 게스트 모드에서는 PDF 업로드 저장 및 Supabase 영속 저장 미지원
- AI 코치 대화 이력은 저장되지만, 화면 재진입 시 과거 대화 자동 복원 로직은 없음

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@react-pdf/renderer` |
| Backend | Python 3.11, FastAPI, LangChain, LangGraph, PyMuPDF |
| AI | Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Vector DB | ChromaDB (job keywords + STAR examples) |
| Auth/DB | Supabase (Auth + PostgreSQL) |
| Deploy | Vercel (frontend), Render (backend) |

## 폴더 구조

```text
isoser/
├── frontend/                 # Next.js 앱
│   ├── app/(auth)/           # 로그인/콜백
│   ├── app/dashboard/        # 온보딩/대시보드/활동/매칭/이력서
│   └── lib/                  # Supabase, API 클라이언트, 타입, 게스트 유틸
├── backend/                  # FastAPI 앱
│   ├── routers/              # parse, coach, match
│   ├── chains/               # PDF 파싱/코치 그래프/매칭 체인
│   └── rag/                  # Chroma 초기화/검색/시드 데이터
└── README.md
```

## 로컬 실행

### 1) 환경변수 준비

```bash
# frontend
cp frontend/.env.local.example frontend/.env.local

# backend
cp backend/.env.example backend/.env
```

### 2) 백엔드 실행

```bash
cd backend
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
python rag/seed.py
uvicorn main:app --reload
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### 3) 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

- Web: `http://localhost:3000`

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
CHROMA_PERSIST_DIR=./chroma_store
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 헬스체크 (`{"status":"ok"}`) |
| POST | `/parse/pdf` | PDF에서 프로필/활동 추출 |
| POST | `/coach/feedback` | STAR 기반 코치 피드백 생성 |
| POST | `/match/analyze` | 공고 매칭 점수/키워드/요약 분석 |

## Supabase 스키마

아래 테이블 기준으로 프론트/백엔드가 동작합니다.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  education TEXT,
  career TEXT[] DEFAULT '{}',
  education_history TEXT[] DEFAULT '{}',
  awards TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  self_intro TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('회사경력', '프로젝트', '대외활동', '학생활동')),
  title TEXT NOT NULL,
  period TEXT,
  role TEXT,
  skills TEXT[],
  description TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_job TEXT,
  template_id TEXT DEFAULT 'simple',
  selected_activity_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE coach_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS는 모든 테이블에 활성화하고, `auth.uid()` 기준 본인 데이터만 접근하도록 정책을 설정해야 합니다.

## 배포

### Frontend (Vercel)
1. 저장소 연결 후 Root Directory를 `frontend`로 지정
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL` 설정
3. 배포 후 Supabase OAuth Redirect URL에 `https://<your-domain>/callback` 등록

### Backend (Render)
1. `backend/render.yaml` 기준 Blueprint 배포
2. 필수 환경변수: `GOOGLE_API_KEY`, `CHROMA_PERSIST_DIR`
3. Start command에서 `python rag/seed.py && uvicorn main:app ...` 순으로 실행
