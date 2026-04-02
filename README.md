# 이소서 (Isoser)

AI 코치 기반 이력서·경력기술서 편집·관리 웹 서비스

> AI가 대신 써주는 것이 아니라, 유저가 직접 한 줄씩 고치는 과정을 AI가 옆에서 코치합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15, TypeScript, Tailwind CSS, react-pdf |
| 백엔드 | Python 3.11, FastAPI, LangChain, LangGraph |
| AI | Gemini 2.5 Flash (Google Generative AI) |
| 벡터DB | ChromaDB (직무 키워드 RAG) |
| 인증/DB | Supabase (PostgreSQL + Auth + Storage) |
| 배포 | Vercel (frontend), Render (backend) |

---

## 폴더 구조

```
isoser/
├── frontend/    # Next.js 15 (App Router)
├── backend/     # FastAPI
└── README.md
```

---

## 로컬 개발 환경 설정

### 1. 환경변수 설정

```bash
# frontend
cp frontend/.env.local.example frontend/.env.local
# .env.local 파일에 실제 값 입력

# backend
cp backend/.env.example backend/.env
# .env 파일에 실제 값 입력
```

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

### 3. 백엔드 실행

```bash
cd backend
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload
# http://localhost:8000
# API 문서: http://localhost:8000/docs
```

### 4. ChromaDB 초기 데이터 적재

```bash
cd backend
python rag/seed.py
```

---

## Supabase 설정

Supabase 프로젝트 생성 후, SQL Editor에서 아래 쿼리를 실행하세요.

```sql
-- 유저 프로필 테이블
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  education TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 활동 테이블
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

-- 이력서 버전 테이블
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

-- AI 코치 대화 이력 테이블
CREATE TABLE coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessions ENABLE ROW LEVEL SECURITY;

-- 본인 데이터만 접근 가능한 정책
CREATE POLICY "본인 프로필만 접근" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "본인 활동만 접근" ON activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "본인 이력서만 접근" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "본인 코치 세션만 접근" ON coach_sessions FOR ALL USING (auth.uid() = user_id);
```

---

## 배포

### 프론트엔드 (Vercel)
1. GitHub 저장소를 Vercel에 연결
2. Root Directory를 `frontend`로 설정
3. 환경변수 설정
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_BACKEND_URL` (Render 백엔드 URL, 예: `https://isoser-backend.onrender.com`)
4. Deploy 실행

### 백엔드 (Render)
1. GitHub 저장소를 Render에 연결
2. Blueprint 배포로 `backend/render.yaml` 적용
3. 환경변수 설정
   - `GOOGLE_API_KEY` (필수)
   - `CHROMA_PERSIST_DIR` (`/opt/render/project/src/chroma_store`)
4. 최초 부팅 시 `python rag/seed.py`가 실행되어 Chroma seed 데이터가 적재됨

### 배포 체크리스트
1. Vercel 배포 URL이 생성되면 프론트 환경변수 `NEXT_PUBLIC_BACKEND_URL`을 Render URL로 고정
2. Render 배포 후 `/docs`, `/parse/pdf`, `/coach/feedback`, `/match/analyze` 응답 확인
3. Vercel에서 Google 로그인 콜백 URL을 `https://<vercel-domain>/callback`으로 Supabase에 등록

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/parse/pdf` | PDF에서 프로필·활동 추출 |
| POST | `/coach/feedback` | AI 코치 피드백 생성 |
| POST | `/match/analyze` | 공고 매칭 분석 |
