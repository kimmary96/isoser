# 이소서 (Isoser)

AI 코치 기반 이력서/경력기술서 편집 서비스입니다.
"AI가 대신 작성"이 아니라, 사용자가 직접 고칠 수 있도록 STAR 기준 피드백을 제공하는 데 초점을 둡니다.

## 개발 상태 (2026-04-06 기준)

### 구현 완료
- Google OAuth 로그인 + 게스트 모드
- 이력서 PDF 업로드 후 프로필/활동 자동 추출 (`/parse/pdf`)
- 대시보드 프로필 편집(이름/희망 직무/아바타), 자기소개/스킬/경력/학력/수상/자격/외국어 편집
- 활동 목록/상세 조회, 활동 편집, STAR 저장
- 활동 상세 STAR 기반 AI 코치 멀티턴 피드백 (`/coach/feedback`)
- 채용 공고 매칭 분석 + 저장/조회/삭제 (`/match/analyze`)
- 이력서 생성 후 문서 저장소(` /dashboard/documents`)에 저장 및 PDF 내보내기
- PDF 한글 폰트 적용(`@react-pdf/renderer` + NotoSansKR)

### 현재 제약
- 템플릿은 UI에 여러 옵션이 보이지만 실제 PDF 출력 포맷은 단순형 중심
- 게스트 모드에서는 DB 영속 저장이 아닌 로컬 저장 기반

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, `@react-pdf/renderer` |
| Backend | Python 3.11, FastAPI, LangChain, LangGraph, PyMuPDF |
| AI | Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Vector DB | ChromaDB |
| Auth/DB | Supabase (Auth + PostgreSQL + Storage) |
| Deploy | Vercel (frontend), Render (backend) |

## 폴더 구조

```text
isoser/
├── frontend/
│   ├── app/(auth)/
│   ├── app/dashboard/
│   └── lib/
├── backend/
│   ├── routers/
│   ├── chains/
│   └── rag/
├── supabase/
│   ├── migrations/
│   │   ├── 001_init_schema.sql
│   │   └── 002_add_bio_to_profiles.sql
│   └── README.md
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

### 3) 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

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

## Supabase 스키마 관리

DB DDL은 SQL Editor에서 직접 작성하지 말고 아래 마이그레이션 파일 기준으로 관리합니다.

- `supabase/migrations/001_init_schema.sql` (기본 테이블/RLS/스토리지)
- `supabase/migrations/002_add_bio_to_profiles.sql` (`profiles.bio` 추가)

실행 가이드는 `supabase/README.md`를 참고하세요.

## 배포

### Frontend (Vercel)
1. 저장소 연결 후 Root Directory를 `frontend`로 지정
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL` 설정
3. 배포 후 Supabase OAuth Redirect URL에 `https://<your-domain>/callback` 등록

### Backend (Render)
1. `backend/render.yaml` 기준 Blueprint 배포
2. 필수 환경변수: `GOOGLE_API_KEY`, `CHROMA_PERSIST_DIR`
3. Start command에서 `python rag/seed.py && uvicorn main:app ...` 순으로 실행
