# 이소서 (Isoser) — CLAUDE.md

## 프로젝트 개요

AI 코치 기반 이력서·경력기술서 편집·관리 웹 서비스.
AI가 대신 써주는 것이 아니라, 유저가 직접 한 줄씩 고치는 과정을 AI가 옆에서 코치한다.

---

## 모노레포 구조

```
isoser/
├── frontend/   # Next.js 15 (App Router, TypeScript, Tailwind)
├── backend/    # FastAPI (Python 3.11)
└── CLAUDE.md
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15, TypeScript, Tailwind CSS, react-pdf, @supabase/ssr |
| 백엔드 | FastAPI, LangChain, LangGraph, ChromaDB, PyMuPDF |
| AI | Gemini 2.5 Flash 단일 LLM (`gemini-2.5-flash`) |
| DB/인증 | Supabase (PostgreSQL + Auth + Storage) |
| 배포 | Vercel (frontend), Render (backend) |

---

## 로컬 개발

```bash
# frontend
cd frontend && npm install && npm run dev        # http://localhost:3000

# backend
cd backend
python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload                         # http://localhost:8000/docs
```

---

## 환경변수

### frontend/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### backend/.env
```
GOOGLE_API_KEY=
CHROMA_PERSIST_DIR=./chroma_store
```

---

## FastAPI 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/parse/pdf` | PDF → 프로필·활동 추출 |
| POST | `/coach/feedback` | STAR 기반 AI 코치 피드백 |
| POST | `/match/analyze` | 공고 매칭 분석 |

---

## Supabase 테이블

| 테이블 | 설명 |
|--------|------|
| `profiles` | 유저 프로필 (name, email, phone, education) |
| `activities` | 활동 (type, title, period, role, skills, description) |
| `resumes` | 이력서 버전 (target_job, selected_activity_ids) |
| `coach_sessions` | AI 코치 대화 이력 (messages JSONB) |

모든 테이블에 RLS 활성화. 본인 데이터만 접근 가능.

---

## ChromaDB 컬렉션

| 컬렉션 | 내용 |
|--------|------|
| `job_keyword_patterns` | 직무별 핵심 키워드·표현 패턴 |
| `star_examples` | STAR 기법이 잘 적용된 이력서 문장 예시 |

유저 데이터 없음. 공통 지식만 저장. `backend/rag/seed_data/`에 JSON 원본, `rag/seed.py`로 적재.

---

## 코드 작성 규칙

- Python: 타입 힌트 필수, 함수마다 한국어 docstring
- 각 파일 상단에 역할 한 줄 주석
- API 키는 환경변수로만 관리 — 코드에 직접 작성 금지
- AI API 호출은 try-except로 감싸고 명확한 에러 메시지 반환
- ChromaDB 장애 시 RAG 없이 동작하도록 fallback 처리
- 오버엔지니어링 금지: 현재 스펙에 불필요한 기술·추상화 추가하지 않음

---

## 구현 단계 (STEP)

| STEP | 내용 | 상태 |
|------|------|------|
| 1 | 프로젝트 초기 세팅 (폴더 구조, 보일러플레이트) | 완료 |
| 2 | ChromaDB 시드 데이터 구축 | 예정 |
| 3 | FastAPI 백엔드 본 구현 | 예정 |
| 4 | Next.js 프론트엔드 본 구현 | 예정 |
| 5 | 배포 설정 (Vercel + Render) | 예정 |
