# 이소서 (Isoser) — CLAUDE.md

## 서비스 정체성 (v2)

> **이소서 = 국가 취업 지원 정보 허브 + AI 코치 기반 이력서 편집**
> HRD클럽이 하던 국비 교육 정보 + 훈련기관 광고 플랫폼을, 인프런 수준의 UI/UX로 재구축하고,
> AI 개인화 추천과 서류 즉시 생성 기능을 더한 서비스.

AI가 대신 써주는 것이 아니라, 유저가 직접 한 줄씩 고치는 과정을 AI가 옆에서 코치한다.
경쟁 상대는 AI 자소서 서비스가 아니라 **고용24, HRD넷, HRD클럽** 같은 정부/민간 취업 정보 사이트다.

### 핵심 전략: 유입 → 체류 → Lock-in → 수익화

1. **유입**: 무료 취업 정보 허브 (비로그인 접근 가능)
2. **체류**: v1 기능(성과저장소·AI 코치·이력서·포트폴리오·자소서·공고매칭) 전체 무료 제공
3. **Lock-in**: 성과저장소에 데이터가 쌓이면 이관 불가
4. **수익화**: Phase 1 구글 애드센스 → Phase 2 훈련기관 광고 상품 → Phase 2.5 광고 제거 구독

---

## 모노레포 구조

```
isoser/
├── frontend/                         # Next.js 15.1 (App Router, TypeScript, Tailwind)
│   ├── app/
│   │   ├── (auth)/                   # 로그인, OAuth 콜백
│   │   ├── (onboarding)/             # 온보딩 프로필 설정
│   │   ├── api/                      # Next.js API Routes (BFF — 모든 데이터 접근 여기 경유)
│   │   │   ├── auth/                 # google, signout
│   │   │   ├── dashboard/            # profile, activities, resume, match, cover-letters, me, ...
│   │   │   ├── onboarding/
│   │   │   └── summary/
│   │   ├── dashboard/                # 메인 앱
│   │   │   ├── _components/          # modal-shell.tsx (공통 모달 셸)
│   │   │   ├── profile/              # hook + lib + 6개 컴포넌트
│   │   │   ├── activities/           # hook + 4개 컴포넌트 (basic-tab, star-tab, coach-panel, modals)
│   │   │   ├── resume/               # hook + preview-pane + assistant-sidebar
│   │   │   │   └── export/           # hook + pdf-download (동적 로딩)
│   │   │   ├── match/                # hook + input-modal + detail-modal
│   │   │   ├── cover-letter/         # hook + [id] 상세
│   │   │   ├── coach/                # 스캐폴드 ("준비 중")
│   │   │   └── portfolio/            # 스캐폴드 ("준비 중")
│   │   └── programs/                 # 프로그램 목록/상세 (비로그인 접근 가능)
│   ├── components/
│   │   └── KakaoMap.tsx
│   └── lib/
│       ├── api/
│       │   ├── app.ts                # 프론트 내부 API 클라이언트
│       │   ├── backend.ts            # FastAPI 백엔드 클라이언트
│       │   └── route-response.ts     # apiOk / apiError 헬퍼 (공통 에러 계약)
│       ├── supabase/                 # client.ts, server.ts
│       └── types/index.ts            # 전체 TypeScript 인터페이스
├── backend/                          # FastAPI (Python 3.10)
│   ├── chains/                       # LangGraph AI 체인
│   ├── rag/                          # ChromaDB RAG 시스템
│   │   ├── collector/                # Work24/HRD/K-Startup 데이터 수집기
│   │   ├── generators/               # STAR·패턴 예시 생성기
│   │   ├── source_adapters/          # NCS, Work24 어댑터
│   │   └── seed_data/                # JSON 원본 데이터
│   ├── routers/                      # FastAPI 라우터 (8개)
│   ├── repositories/                 # DB 접근 레이어 (coach_session_repo.py)
│   ├── schemas/                      # Pydantic 모델
│   ├── utils/
│   │   └── supabase_admin.py         # Supabase admin 접근 공통화 (SUPABASE_SERVICE_ROLE_KEY)
│   ├── data/
│   │   └── role_skill_map.json       # 직무별 스킬 정적 매핑
│   ├── tests/                        # 테스트 15개 파일
│   └── main.py
├── docs/
│   ├── 이소서 (Isoser) v2 — 통합 사업계획서.md
│   ├── current-state.md
│   ├── refactoring-log.md
│   ├── api-contract.md               # Next App API + FastAPI 계약 문서
│   ├── prd.md
│   ├── claude-project-instructions.md
│   └── codex-workflow.md
├── tasks/
│   ├── inbox/                        # 로컬 Codex watcher 입력
│   ├── running/                      # 로컬 실행 중 task
│   ├── done/                         # 로컬 완료 task
│   ├── blocked/                      # 필드 누락/실패/드리프트 검토 필요 task
│   └── remote/                       # 원격 GitHub Action용 task
├── reports/                          # Codex 결과/차단/드리프트 보고서
├── scripts/
│   └── run_watcher.ps1               # Windows watcher 실행 스크립트 (-B)
├── AGENTS.md                         # Codex 작업 규칙
├── watcher.py                        # tasks/inbox 감시 -> Codex 실행
└── CLAUDE.md
```

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15.1, TypeScript 5, Tailwind CSS 3.4, @react-pdf/renderer 4.0 |
| 백엔드 | FastAPI 0.115, LangChain 0.3, LangGraph 0.2, PyMuPDF 1.24 |
| AI | Gemini 2.5 Flash (`gemini-2.5-flash`) 단일 LLM, Gemini Embedding (`gemini-embedding-001`) |
| 벡터 DB | ChromaDB 0.5 에피머럴 모드 (Render 512MB 대응) |
| DB/인증 | Supabase (PostgreSQL + GoTrue Auth + Storage), PKCE + `@supabase/ssr` 쿠키 세션 |
| 배포 | Vercel (frontend), Render (backend) |

---

## 로컬 개발

```bash
# frontend
cd frontend && npm install && npm run dev        # http://localhost:3000

# backend
cd backend
python -m venv .venv                 # Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload                         # http://localhost:8000/docs
```

- 로컬 표준 가상환경 경로는 `backend/.venv`

---

## 작업 자동화 구조

### 기본 원칙
- Claude는 기획과 명세 작성 담당
- 로컬 구현 자동화는 Codex가 담당
- 원격 fallback 자동화는 현재 Claude Code GitHub Action 사용

### 운영 폴더 의미
- `cowork/packets`: 사람이 작성하고 계속 수정하는 원본 task packet
- `cowork/reviews`: 원본 packet에 대한 review 결과 문서
- `tasks/inbox`: 승인된 최신 packet 사본이 들어가는 로컬 실행 큐
- `tasks/remote`: 승인된 최신 packet 사본이 들어가는 원격 fallback 큐
- `tasks/done|blocked|drifted`: 실행 결과 상태 큐

### cowork review -> local execution 경로
```text
Claude에서 기획
-> cowork/packets/<task-id>.md 저장
-> cowork_watcher.py가 review 생성
-> cowork/reviews/<task-id>-review.md 확인
-> 필요 시 cowork/packets 원본 수정
-> review와 packet이 맞으면 승인
-> 최신 packet을 tasks/inbox/<task-id>.md로 복사
-> watcher.py 감지
-> tasks/running 이동
-> Codex가 AGENTS.md를 읽고 구현/검사/보고서 작성
-> 결과에 따라 tasks/done | tasks/blocked | tasks/drifted 이동
```

### 원격 fallback 경로
```text
PC가 꺼져 있을 때
-> cowork review/approval 이후 tasks/remote/<task-id>.md push
-> .github/workflows/claude-dev.yml 실행
-> Claude Code가 repo 확인 후 원격 구현 진행
```

- 현재 안정 운영 기준의 원격 fallback 인증 방식은 `ANTHROPIC_API_KEY`
- OAuth smoke test workflow는 보관 중이지만 운영 경로는 아님

### 주의
- 로컬 실행 큐는 `tasks/inbox`
- 원격 보조 경로는 `tasks/remote`
- `cowork/`는 scratch/review workspace이며 execution queue가 아님
- review markdown은 `cowork/reviews`에 남고, 실행 큐에는 review 문서가 아니라 승인된 최신 packet 사본이 들어감
- `[codex]` 커밋 메시지는 로컬 Codex 자동화 전용
- 원격 워크플로는 `[codex]` 커밋으로 재트리거되지 않게 설정됨
- 상세 규칙은 `AGENTS.md`, `docs/current-state.md`, `docs/codex-workflow.md` 참고

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
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## 아키텍처 원칙 (리팩토링 이후 확립)

### 데이터 접근 계층 구조
```
브라우저 → Next API Route (/api/dashboard/**) → Supabase 또는 FastAPI
```
- 브라우저에서 Supabase 직접 접근 금지 (F12 내부 구조 노출 방지)
- 모든 대시보드 데이터는 Next API Route를 경유
- FastAPI 직접 호출이 필요한 AI 기능도 Next API Route 경유

### API 에러 계약 (`frontend/lib/api/route-response.ts`)
- 모든 JSON route: `{ error: string, code: string }` 형식 통일
- `apiOk(data)`, `apiError(error, status, code)` 헬퍼 사용
- redirect route 예외: `GET /api/auth/google`, `GET /auth/callback`

### 인증 흐름
- `로그인 → 온보딩 → 대시보드` 단일 퍼널
- 게스트 모드 없음 (`frontend/lib/guest.ts` 삭제됨)
- `/dashboard`는 로그인 사용자 전제만 유지

### 페이지 구조 패턴
- 데이터/상태 로직 → `_hooks/use-*.ts`로 분리
- UI 조각 → `_components/*.tsx`로 분리
- 공통 모달 → `dashboard/_components/modal-shell.tsx` 사용

---

## FastAPI 엔드포인트 (8개 라우터, 20+ 엔드포인트)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/parse/pdf` | PDF → 프로필·활동 추출 |
| POST | `/coach/feedback` | STAR 기반 AI 코치 피드백 + 6단계 구조 진단 |
| GET | `/coach/sessions` | 유저 코치 세션 목록 |
| GET | `/coach/sessions/{id}` | 코치 세션 대화 이력 |
| POST | `/match/analyze` | 공고 매칭 분석 (호환도 점수·등급 A+~D) |
| POST | `/match/rewrite` | 공고 기반 활동 AI 재작성 |
| POST | `/match/extract-job-image` | 공고 이미지 OCR 추출 |
| POST | `/match/extract-job-pdf` | 공고 PDF 텍스트 추출 |
| GET | `/skills/suggest` | 직무 기반 스킬 추천 (role_skill_map.json) |
| POST | `/activities/convert` | 활동 → STAR/포트폴리오 형식 변환 |
| POST | `/company/insight` | 기업 리서치 인사이트 생성 |
| GET | `/programs` | 훈련 프로그램 목록 (페이지네이션) |
| GET | `/programs/popular` | 인기 프로그램 TOP N (랜딩용) |
| GET | `/programs/{id}` | 프로그램 상세 |
| POST | `/programs/recommend` | AI 맞춤 프로그램 추천 (RAG) |
| POST | `/programs/sync` | Work24 API 백그라운드 동기화 |
| GET | `/bookmarks` | 북마크한 프로그램 목록 |
| POST | `/bookmarks/{id}` | 북마크 추가 |
| DELETE | `/bookmarks/{id}` | 북마크 삭제 |
| POST | `/admin/sync/programs` | 관리자: 프로그램 전체 동기화 |

### v2 신규 예정 엔드포인트 (`docs/api-contract.md` 참고)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/recommend/calendar` | 캘린더용 맞춤 추천 (리랭킹: 관련도 60% + 마감임박 40%) |
| POST | `/chat` | 정보 검색 AI 챗봇 (RAG) |
| POST | `/portfolio/generate` | 포트폴리오 자동 생성 (6섹션) |

---

## AI 체인 (LangGraph 기반, `backend/chains/`)

| 체인 | 파일 | 주요 기능 |
|------|------|-----------|
| Coach Graph | `coach_graph.py` | 6단계 구조 진단 + RAG 예시 검색 + 피드백 3종 생성 |
| Intro Generate | `coach_graph.py` (mode=intro_generate) | 활동 입력값으로 한 줄 소개 1~3개 생성 |
| PDF Parse | `pdf_chain.py` | 이력서 PDF → 프로필 + 활동 목록 구조화 |
| Match Analysis | `match_chain.py` | 키워드 중복 스코어링 + 등급(A+~D) + 강점/갭/팁 |
| Job Posting Rewrite | `job_posting_rewrite_chain.py` | 공고 키워드 기반 활동 재작성 제안 |
| Company Research | `company_research.py` | 기업명 → AI 리서치 인사이트 |
| Job Image Extract | `job_image_chain.py` | 공고 이미지 → 텍스트 OCR (Vision) |

---

## Supabase 테이블

| 테이블 | 설명 |
|--------|------|
| `profiles` | 유저 프로필 (name, bio, portfolio_url, email, phone, education, career, awards, certifications, languages, skills, self_intro) |
| `activities` | 활동 (type, title, period, role, skills, description, STAR 필드, 조직/기여/이미지) |
| `resumes` | 이력서 버전 (target_job, selected_activity_ids) |
| `cover_letters` | 자기소개서 (company, job_title, content, qa_items 배열) |
| `coach_sessions` | AI 코치 대화 이력 (job_title, section_type, feedback JSONB) |
| `programs` | 훈련 프로그램 (source, title, category, target, skills, region, deadline, is_ad, sponsor_name, embedding_id) |
| `program_bookmarks` | 유저별 북마크 |
| `match_analyses` | 공고 매칭 분석 이력 (점수, 키워드, 요약, 상세 payload) |
| `portfolios` | 스키마 존재, v2 본격 사용 예정 |
| `recommendations` | 맞춤 추천 결과 캐싱 24시간 (user_id, program_id, similarity_score, urgency_score, final_score) — **v2 예정** |

모든 테이블에 RLS 활성화. 본인 데이터만 접근 가능.
비로그인은 `programs` 읽기만 허용.

### 마이그레이션 규칙
- 기존 마이그레이션 파일 수정 금지 — 변경은 새 SQL 파일로 추가
- `supabase/migrations/` 경로 관리, SQL Editor 직접 수정 금지

---

## ChromaDB 컬렉션

| 컬렉션 | 내용 |
|--------|------|
| `job_keyword_patterns` | 직무별 핵심 키워드·표현 패턴 (NCS + 실제 공고) |
| `star_examples` | STAR 기법이 잘 적용된 이력서 문장 예시 |
| `job_posting_snippets` | 실제 채용 공고 요구사항 (사람인·잡코리아·원티드) |
| `programs` | 훈련 프로그램 인덱스 (Work24 동기화) |

유저 데이터 없음. 공통 지식만 저장. `backend/rag/seed_data/`에 JSON 원본, `rag/seed.py`로 적재.
임베딩 모델: `gemini-embedding-001` (Google Gemini).
Render 512MB 대응을 위해 에피머럴 모드 사용. 재시작 시 `seed.py`로 재적재.

---

## 프론트엔드 페이지 현황

| 경로 | 상태 | 설명 |
|------|------|------|
| `/` (또는 `/programs`) | **v2 개편 예정** | 랜딩 페이지 — 광고 허브 (비로그인 접근) |
| `/login` | 완료 | Google OAuth 로그인 |
| `/onboarding` | 완료 | 최초 프로필 설정 |
| `/dashboard` | 완료 | 대시보드 홈 |
| `/dashboard/profile` | 완료 | 프로필 편집 (hook + 6개 컴포넌트 분리) |
| `/dashboard/activities` | 완료 | 활동 목록 (타입별 필터) |
| `/dashboard/activities/new` | 완료 | 활동 생성 |
| `/dashboard/activities/[id]` | 완료 | 활동 편집 + AI 코치 패널 (hook + 4개 컴포넌트 분리) |
| `/dashboard/resume` | 완료 | 이력서 빌더 (hook + preview + sidebar 분리) |
| `/dashboard/resume/export` | 완료 | PDF 내보내기 (동적 로딩, 번들 최소화) |
| `/dashboard/cover-letter` | 완료 | 자기소개서 목록 |
| `/dashboard/cover-letter/[id]` | 완료 | 자기소개서 편집 (hook 분리) |
| `/dashboard/match` | 완료 | 공고 매칭 분석 (hook + input/detail 모달 분리) |
| `/dashboard/documents` | 완료 | 문서 전체 관리 |
| `/programs` | 완료 | 훈련 프로그램 목록/상세 (비로그인 접근) |
| `/dashboard/coach` | 스캐폴드 | "준비 중" — v2 AI 챗봇으로 확장 예정 |
| `/dashboard/portfolio` | 스캐폴드 | "준비 중" — v2 포트폴리오 자동 생성 예정 |

---

## 코드 작성 규칙

- Python: 타입 힌트 필수, 함수마다 한국어 docstring
- 각 파일 상단에 역할 한 줄 주석
- API 키는 환경변수로만 관리 — 코드에 직접 작성 금지
- AI API 호출은 try-except로 감싸고 명확한 에러 메시지 반환
- ChromaDB 장애 시 RAG 없이 동작하도록 fallback 처리
- 오버엔지니어링 금지: 현재 스펙에 불필요한 기술·추상화 추가하지 않음
- 프론트 새 페이지는 hook(`_hooks/`) + 컴포넌트(`_components/`) 분리 패턴 유지
- Next API route는 반드시 `apiOk` / `apiError` 헬퍼로 응답

---

## Task Packet 규칙

- Claude는 구현 프롬프트 대신 Task Packet만 출력
- 표준 템플릿은 `docs/task-packet-template.md`
- 필수 frontmatter:
  - `id`
  - `status`
  - `type`
  - `title`
  - `planned_at`
  - `planned_against_commit`
- 로컬 실행용 packet은 `tasks/inbox/`
- 원격 실행용 packet은 `tasks/remote/`

---

## 운영 문서

- `AGENTS.md`: Codex 작업 규칙
- `docs/current-state.md`: 현재 자동화 구조와 운영 상태
- `docs/refactoring-log.md`: 구조 변경 로그
- `docs/claude-project-instructions.md`: Claude 프로젝트 instructions 원본
- `docs/codex-workflow.md`: Codex/Claude 자동화 운영 문서

## 코워크 규칙

- `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/*.md`는 기준 문서로 취급하며 코워크에서 읽기만 한다.
- 코워크용 임시 작업공간은 사용자가 명시적으로 요청한 경우에만 만든다.
- 코워크는 기준 문서를 직접 수정하지 않고, 변경 제안이 필요하면 채팅으로만 제안한다.
- 실제 실행용 Task Packet은 사람 검토 후 `tasks/inbox/` 또는 `tasks/remote/`로 옮긴다.

---

## 구현 현황

### 완료
- 인증: Google OAuth + Supabase 세션 (게스트 모드 제거됨)
- 온보딩: 이력서 PDF → 프로필/활동 자동 추출
- 성과저장소: 활동 CRUD + STAR + AI 코치 (멀티턴 세션 저장/복원)
- 공고 매칭 분석: 텍스트/OCR/PDF → 점수·등급·강점·갭
- 공고 기반 AI 재작성
- 이력서 빌더 + PDF 내보내기
- 자기소개서 목록/편집 + AI 코칭
- 훈련 프로그램 추천 + 북마크
- 데이터 접근 전면 서버 경유화 (브라우저 직접 Supabase 접근 없음)
- API 에러 계약 통일 (`{ error, code }`)

### 미완료 (v2 다음 단계)
- 랜딩 페이지 광고 허브 전면 개편
- 대시보드 AI 맞춤 캘린더 뷰 (마감 임박 하이라이트)
- 지원 서류 즉시 생성 연결 (캘린더 → 이력서 프리필)
- 포트폴리오 자동 생성 (6섹션)
- 정보 검색 AI 챗봇 (`/dashboard/coach`)
- `recommendations` 테이블 + 하이브리드 리랭킹 추천 엔진
- 광고 슬롯 UI (애드센스 Phase 1)
- `DashboardMeResponse` 타입 계약 정리 (`frontend/lib/types/index.ts`)

### 알려진 기술 부채
- `backend/rag/source_adapters/work24_job_support.py` — TODO/placeholder 잔존
- `frontend/get_token.mjs` — access token 직접 출력 (로컬 전용이나 보안 위생상 정리 필요)
