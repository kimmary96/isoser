# 이소서 (Isoser)

> AI 이력서 · 경력기술서 에디터 서비스
> PRD  |  Product Requirements Document
> v1.0  |  2026.04

## 1. 서비스 개요

### 1.1 서비스 한 줄 정의

기존 이력서 PDF 한 장 업로드로 시작하는, AI 코치 기반 이력서·경력기술서 편집·관리 서비스

AI가 대신 써주는 것이 아니라, 유저가 직접 한 줄씩 고치는 과정을 AI가 옆에서 코치한다. 한 곳에서 모든 경력과 활동을 관리하면, 지원하는 직무와 회사에 맞게 조합과 양식을 자유롭게 바꿀 수 있다.

### 1.2 핵심 차별점 3가지

- PDF 업로드 온보딩: 빈칸부터 채우게 하지 않는다. 기존 이력서에서 파싱해서 즉시 시작 가능
- 활동 데이터 영구 보존 + 조합: 한번 입력한 활동은 사라지지 않고, 지원 직무에 따라 넣었다 빼도 원본은 유지
- AI 코치 방식: 유저가 쓴 문장을 STAR 기준·정량화·구조로 피드백 (AI가 대신 쓰는 방식 지양)

## 2. 시장 분석

| 구분 | 수치 | 출처 |
| --- | --- | --- |
| 글로벌 이력서 최적화 시장 (2024) | 약 3,500만 달러 (470억 원) | 시장조사 |
| 글로벌 이력서 최적화 시장 (2033 예측) | 약 116억 달러로 성장 | 시장조사 |
| 국내 채용 플랫폼 MAU 1위 잡코리아 (2025) | 2,056만 명 | 잡코리아 |
| 국내 채용 플랫폼 MAU 2위 사람인 (2025) | 1,889만 명 | 사람인 |
| AI 자소서 활용 비율 (2023 하반기 → 2025 1분기) | 7% → 69% (1년 반 만에 9배) | 무하유, 2025 |
| Z세대 AI 자소서 활용 경험 | 91% | 캐치, 2025 |
| 국내 이직 준비 실업자 (2024) | 107만 9천 명 | 통계청, 2024 |
| 취준생 1인 평균 지원 기업 수 | 6.4개사 | 대학내일20대연구소, 2024 |

### 시장 기회 요약

- AI 코치 방식의 전문 편집 서비스는 아직 공백 - 진입 타이밍 유리
- 주요 포털은 자사 플랫폼 내 이력서 관리에 한정 → 포털 간 통합 관리 니즈 미충족
- 연간 100만 명 이상의 이직·취업 준비자가 복수 포털 동시 이용 → 반복 작성 고통 해소 시장 명확

## 3. 문제 정의 (Pain Point)

### 3.1 핵심 페인포인트 4가지

- 각 취업 포털마다 이력서 양식이 달라 빈칸을 새로 채워야 한다
- 내용이 바뀔 때마다 포털마다 따로 업데이트해야 해서 포털별 내용이 달라진다
- 프로젝트·대외활동·부트캠프 내역을 한곳에서 항목별로 정리할 공간이 없다
- 재직 중 성과를 기록하고 싶지만 별도 툴(노션 등)에서 따로 관리해서 이력서 연결이 안 된다

### 3.2 이 문제가 돈이 되는 이유

| 관점 | 내용 |
| --- | --- |
| 긴급성 | 취업 시즌에 이력서를 여러 곳에 동시 제출해야 하는 상황이 반복적으로 발생 |
| 반복성 | 이직 고민은 직장인 생애주기 내내 반복되며, 매번 동일한 고통이 발생 |
| 기존 해결책 한계 | 노션·메모앱은 이력서로 변환 안 됨. 취업 포털은 포털 안에 갇혀 있음 |

## 4. 타깃 및 페르소나

### 4.1 MVP 1순위 타깃

여러 회사에 동시 지원 중인 취준생 - 특히 부트캠프 수강생

부트캠프 수강생은 프로젝트 단위 기록이 몸에 배어 있고, 커뮤니티 내 입소문이 빠르며, 기술 친화적이어서 초기 피드백 품질이 높다.

### 4.2 페르소나 3유형

| 구분 | 특징 | 핵심 니즈 | 사용 트리거 |
| --- | --- | --- | --- |
| 페르소나 A<br>부트캠프 취준생 | 프로젝트 3~5개 보유<br>이력서 작성 경험 적음<br>여러 직무에 동시 지원 | 프로젝트별 정리해서 이력서·포폴에 녹이고 싶음 | 수료 후 취업 준비 시작<br>스터디 내 공유 |
| 페르소나 B<br>이직 준비 재직자 | 경력 5~15년 사무직<br>성과 기록은 있지만 흩어져 있음<br>직무에 따라 강조점이 달라야 함 | 지원 직무에 따라 경력 조합<br>이력서 퀄리티 향상 | 연말 인사평가 시즌<br>이직 결심 순간 |
| 페르소나 C<br>헤드헌터 (B2B) | 시니어 후보자 이력서를 대신 정리하는 업무<br>회사 맞춤 버전 빠르게 필요 | 후보자 기록 기반으로 회사별 맞춤 이력서 빠르게 생성 | 후보자 DB 관리<br>채용 의뢰 접수 시 |

## 5. 경쟁사 분석

| 서비스 | 핵심 성격 | 이력서 관리 | 활동 기록 | AI 코치 | 약점 |
| --- | --- | --- | --- | --- | --- |
| 커리어노트 | PPT 포트폴리오 디자인 툴 | △ 부수 기능 | ○ 프로젝트 관리 | △ 서술 생성만 | 이력서 관리 없음 |
| 사람인 마이커리어 | 자사 포털 이력서 관리 | ○ 자사 양식 한정 | ○ 자사 이력서 기록 가능 | △ 문장이 길고 부자연스러움 | 포털 밖 사용 불가 |
| 잡코리아 | 채용 포털 | ○ 자사 양식 한정 | ○ 자사 이력서 기록 가능 | 없음 | 디자인 올드, 이식성 없음 |
| 원티드 | 채용 포털 | ○ 자사 양식 한정 | ○ 자사 이력서 기록 가능 | 없음 | 포털 밖 활동 이식 불가 |
| ChatGPT/Claude | 범용 AI | △ 매번 새로 요청 | 없음 | ○ | 데이터 누적 없음, UX 없음 |
| 이소서 (우리) | 이력서·경력기술서 에디터 | ○ 다양한 양식 지원 | ○ 영구 저장·조합 | ○ 항목별 실시간 멀티턴 코치 | 초기 유저 확보 필요 |

## 6. 핵심 기능 명세 (PRD - I/P/O)

각 기능은 입력(Input) → 처리(Process) → 출력(Output) 구조로 정의한다. 개발자가 오해 없이 즉시 구현 가능한 수준을 목표로 한다.

### 기능 1. PDF 업로드 자동 파싱 온보딩

| 구분 | 내용 |
| --- | --- |
| 입력 (Input) | 이력서 PDF 파일 (최대 10MB, 텍스트 레이어 있는 PDF 기준)<br>파일 형식: multipart/form-data { file: PDF 바이너리 } |
| 처리 (Process) | 1. PyMuPDF로 PDF 전체 텍스트 추출<br>2. LangChain 파싱 체인 구성 → Gemini 2.5 Flash 호출<br>3. 프롬프트: 이름, 연락처, 학력, 경력, 프로젝트를 아래 JSON 형식으로 추출해줘 (출력 형식 고정)<br>4. 구조화된 JSON 반환 → Supabase profiles + activities 테이블 저장 |
| 출력 (Output) | 프로필 카드: 이름, 연락처, 학력<br>활동 카드 리스트: 프로젝트, 수상, 자격증 (유형별 분류)<br>파싱 실패 항목: 인라인 편집 UI 자동 노출 |
| 예외 처리 | 스캔 이미지 PDF (텍스트 레이어 없음): 파싱 실패 안내 + 직접 입력 모드 전환<br>PDF 없는 신규 유저: 직접 입력 모드로 시작 가능 |

### 기능 2. 활동 관리 노트 (커리어 기록장)

| 구분 | 내용 |
| --- | --- |
| 입력 (Input) | 활동 유형: 회사경력 / 프로젝트 / 대외활동 / 학생활동<br>입력 항목: 기간, 역할, 사용 기술(태그), 활동 소개, 이미지(선택) |
| 처리 (Process) | 1. 유저가 활동 항목 입력 또는 수정<br>2. Supabase activities 테이블에 저장 (user_id 기반 격리)<br>3. is_visible 플래그로 이력서 포함 여부 관리 (삭제가 아님 - 원본 유지) |
| 출력 (Output) | 활동 목록 화면: 유형별 필터링, 기간 정렬<br>이력서에서 제외해도 노트에서는 원본 유지<br>재직자 일상 기록 지원: 업무일지처럼 가볍게 수시 입력 가능 |
| 예외 처리 | 입력 도중 이탈 시 임시저장 (localStorage 활용)<br>동일 활동 중복 입력 시 경고 안내 |

### 기능 3. AI 코치 피드백 (핵심 기능, LangGraph 멀티턴)

| 구분 | 내용 |
| --- | --- |
| 입력 (Input) | activity_description: 유저가 입력한 활동 설명 텍스트<br>job_title: 지원 직무 (선택)<br>session_id: 대화 세션 ID (멀티턴 유지용)<br>history: 이전 대화 이력 배열 (JSONB) |
| 처리 (Process) | 1. ChromaDB RAG 검색: 지원 직무 키워드 패턴 및 STAR 예시 검색<br>2. LangGraph 상태 관리: 이전 피드백 이력 + 현재 입력 + RAG 컨텍스트 조합<br>3. Gemini 2.5 Flash 호출: STAR 기준 분석 및 피드백 생성<br>4. 대화 이력 Supabase coach_sessions 테이블에 저장 |
| 출력 (Output) | [빠진 항목] STAR(Situation·Task·Action·Result) 중 누락된 항목 안내<br>[정량화 제안] 숫자로 바꿀 수 있는 표현 제시<br>[문장 개선] 더 강한 동사 또는 구조 제안<br>missing_elements 배열: 아직 보완 안 된 항목 목록<br>iteration_count: 몇 번째 수정인지 (반복 코칭 추적) |
| 멀티턴 특성 | 이전 피드백을 기억하여 연속 코칭 가능<br>예: 아까 Result가 없다고 했죠? 이번엔 Result가 들어갔지만 정량화가 빠져 있습니다<br>RAG를 통해 지원 직무 맞춤 표현 패턴 참고하여 피드백 고도화 |
| 예외 처리 | Gemini API 호출 실패 시: ChromaDB RAG 결과만으로 기본 피드백 제공 (fallback)<br>입력 텍스트 10자 미만: 피드백 요청 전 최소 길이 안내 |

### 기능 4. 공고 매칭 분석

| 구분 | 내용 |
| --- | --- |
| 입력 (Input) | job_posting: 공고 텍스트 전문 (붙여넣기 또는 이미지 업로드)<br>activities: 유저의 활동 목록 전체 (Supabase에서 조회) |
| 처리 (Process) | 1. 공고 텍스트 + 유저 활동 전체를 Gemini 2.5 Flash에 전달<br>2. 직무 일치도, 핵심 기술/역량, 경력 연차, 성과 및 업무 성취 4개 축 분석<br>3. 매칭 점수 산출 (0~100점) 및 부족 키워드 추출 |
| 출력 (Output) | match_score: 종합 매칭 점수 (예: 72점)<br>matched_keywords: 공고와 일치하는 내 역량 리스트<br>missing_keywords: 부족한 역량 리스트<br>recommended_activities: 이 공고에 강조해야 할 활동 ID 목록<br>summary: 2~3줄 요약 설명 |
| 예외 처리 | 공고 텍스트 50자 미만: 분석 불가 안내<br>이미지 업로드 공고: Gemini Vision으로 텍스트 추출 후 동일 처리 |

### 기능 5. 이력서 출력 (양식 변환 및 PDF 저장)

| 구분 | 내용 |
| --- | --- |
| 입력 (Input) | selected_activity_ids: 유저가 선택한 활동 ID 배열<br>target_job: 지원 직무명<br>template_id: 선택한 템플릿 (simple / startup / formal) |
| 처리 (Process) | 1. Supabase에서 선택된 활동 데이터 조회<br>2. 템플릿 JSON에 유저 데이터 끼워 넣기 (Next.js 렌더링)<br>3. react-pdf로 브라우저에서 직접 PDF 생성 (서버 실행 시간 제한 없음) |
| 출력 (Output) | PDF 미리보기 화면 (실시간 렌더링)<br>PDF 다운로드 버튼<br>플랫폼별 텍스트 복사: 사람인·잡코리아 양식에 맞는 포맷으로 클립보드 복사 |
| 템플릿 종류 | simple: 심플 단컬럼 (기본값)<br>startup: 스타트업 자유형 (2컬럼)<br>formal: 대기업 포멀 (보수적 레이아웃) |
| 예외 처리 | 활동 미선택 시: 최소 1개 선택 안내<br>PDF 생성 실패 시: 텍스트 복사 모드로 fallback |

## 7. 유저 플로우

| 단계 | 화면 | 유저 행동 | 서비스 처리 |
| --- | --- | --- | --- |
| Step 1 | 랜딩 → 회원가입 | 소셜 로그인 (카카오·구글) | Supabase Auth 계정 생성 |
| Step 2 | 온보딩 선택 | PDF 업로드 또는 직접 입력 선택 | 분기 처리 |
| Step 3 | PDF 파싱 | 이력서 PDF 업로드 | PyMuPDF 추출 → LangChain → Gemini 파싱 |
| Step 4 | 파싱 결과 확인 | 추출 내용 검토·수정 | Supabase profiles + activities 저장 |
| Step 5 | 활동 상세 편집 | 활동별 AI 코치 피드백 확인·적용 | LangGraph 멀티턴 코치 세션 시작 |
| Step 6 | 이력서 출력 | 직무 선택 → 활동 조합 → 템플릿 선택 → PDF 저장 | react-pdf 브라우저 렌더링 |

## 8. 기술 스택

### 8.1 MVP 확정 스택

| 레이어 | 기술 | 비용 | 역할 |
| --- | --- | --- | --- |
| AI 오케스트레이션 | LangChain + LangGraph | 무료 (라이브러리) | 파이프라인 구성 + 멀티턴 대화 상태 관리 |
| LLM | Gemini 2.5 Flash | 무료 티어 → $0.15/1M 토큰 | PDF 파싱, AI 코치, 공고 매칭 전담 |
| VectorDB | ChromaDB | 무료 오픈소스 | 직무 키워드 패턴 + STAR 예시 RAG |
| 백엔드 | Python FastAPI | 무료 (Render 무료 티어) | AI 처리 API 전담 |
| 프론트엔드 | Next.js 15 (TypeScript) | 무료 (Vercel 무료 티어) | 화면 UI + 유저 인터랙션 |
| DB | Supabase (PostgreSQL) | 무료 티어 (500MB) | 유저·활동·이력서 데이터 저장 |
| 인증 | Supabase Auth | 무료 티어 포함 | 카카오·구글 소셜 로그인 |
| 파일 저장 | Supabase Storage | 무료 티어 (1GB) | PDF 원본 업로드 저장 |
| PDF 출력 | react-pdf | 무료 오픈소스 | 브라우저에서 직접 PDF 생성 |
| 배포 프론트 | Vercel | 무료 티어 | Next.js 최적 배포 환경 |
| 배포 백엔드 | Render | 무료 티어 (월 750시간) | FastAPI 배포 |

### 8.2 설계 원칙

- Gemini 2.5 Flash 단일 LLM 라인: API 키 1개, 결제 창구 1개
- ChromaDB는 공통 지식 전용: 유저 데이터 저장 안 함. 직무 키워드 패턴 등 불변 데이터만 저장
- ChromaDB seed 데이터는 GitHub에 포함: Render 무료 티어 파일 휘발 문제 대응
- API 키 코드 직접 작성 금지: .env 환경변수 전용 관리
- ChromaDB 초기화 실패 시 RAG 없이 동작하는 fallback 처리 필수

## 9. 데이터 모델 (Supabase)

| 테이블 | 주요 컬럼 | 역할 |
| --- | --- | --- |
| profiles | id (UUID, FK → auth.users), name, email, phone, education | 유저 프로필 정보 |
| activities | id, user_id, type (ENUM), title, period, role, skills (TEXT[]), description, is_visible (BOOL) | 유저 활동 기록 (영구 보존, 삭제 없음) |
| resumes | id, user_id, title, target_job, template_id, selected_activity_ids (UUID[]) | 이력서 버전 관리 |
| coach_sessions | id, user_id, activity_id, messages (JSONB), iteration_count | AI 코치 멀티턴 대화 이력 |

모든 테이블에 RLS(Row Level Security) 적용: 본인 데이터만 접근 가능

## 10. API 엔드포인트 명세

| 메서드 | 경로 | 역할 | 주요 입력 | 주요 출력 |
| --- | --- | --- | --- | --- |
| POST | /parse/pdf | PDF 파싱 | file (PDF binary) | { profile, activities } |
| POST | /coach/feedback | AI 코치 피드백 (멀티턴) | { session_id, activity_description, job_title, history } | { feedback, missing_elements, iteration_count, updated_history } |
| POST | /match/analyze | 공고 매칭 분석 | { job_posting, activities } | { match_score, matched_keywords, missing_keywords, recommended_activities, summary } |

## 11. ChromaDB RAG 설계

| 컬렉션 | 데이터 내용 | 용도 |
| --- | --- | --- |
| job_keyword_patterns | 직무별 핵심 키워드 및 표현 패턴 (PM, 백엔드, 프론트, 마케터, 기획자 각 10건 이상) | AI 코치 피드백 시 직무 맞춤 표현 참고 |
| star_examples | STAR 기법이 잘 적용된 이력서 문장 예시 (20건 이상), 정량화 표현 예시 | AI 코치 피드백 시 좋은 문장 예시 참고 |

- seed_data/ 폴더에 JSON 원본 데이터 관리 (GitHub 포함)
- seed.py 스크립트로 서버 시작 시 ChromaDB 자동 초기화
- ChromaDB 초기화 실패 시 서버 중단 없이 RAG 없이 동작하는 fallback 처리

## 12. 수익 모델

| 티어 | 대상 | 가격 | 포함 내용 |
| --- | --- | --- | --- |
| Free | 개인 유저 | 무료 | 프로필·활동 무제한 기록<br>이력서 편집<br>PDF 출력 1회 무료 |
| 건별 결제 | 개인 유저 | 1,000원/회 | PDF 저장 1회 또는 템플릿 디자인 변경 1회 |
| 구독 Standard | 개인 유저 (취준 활성기) | 9,900원/월 | 무제한 PDF 출력<br>무제한 템플릿 변경 |
| 구독 Pro | 개인 유저 + 헤비 유저 | 29,900원/월 | Standard 포함<br>AI 코치 무제한<br>공고 매칭 분석 무제한<br>플랫폼별 양식 변환 |
| B2B (Phase 2) | 헤드헌터·기업 HR | 별도 협의 | 후보자 프로필 열람권<br>회사 맞춤 이력서 대량 생성<br>채용 공고 노출 |

## 13. 개발 로드맵

### 13.1 메인 프로젝트 1 (8일, 03.31 ~ 04.09)

| 일차 | 단계 | 주요 작업 | 산출물 |
| --- | --- | --- | --- |
| 1일차 | 프로젝트 세팅 | 폴더 구조 생성, Next.js 15 + FastAPI 초기화, Supabase 테이블 생성, .env 환경변수 설정 | 프로젝트 초기 구조, README.md |
| 2일차 | ChromaDB 데이터 구축 | seed_data JSON 작성 (직무 키워드, STAR 예시), seed.py 구현, chroma_client.py 구현 | ChromaDB 초기화 완료 |
| 3일차 | PDF 파싱 체인 | chains/pdf_chain.py (LangChain + Gemini), routers/parse.py 엔드포인트 | POST /parse/pdf 작동 |
| 4일차 | AI 코치 그래프 | chains/coach_graph.py (LangGraph + ChromaDB RAG), routers/coach.py | POST /coach/feedback 작동 |
| 5일차 | 공고 매칭 체인 | chains/match_chain.py, routers/match.py | POST /match/analyze 작동 |
| 6일차 | Next.js UI | 온보딩, 활동 관리, AI 코치 화면 구현 | 주요 화면 렌더링 완료 |
| 7일차 | Supabase 연동 | 인증, 데이터 저장/조회 연결, 전체 흐름 통합 테스트 | E2E 흐름 작동 |
| 8일차 | 배포 | Render + Vercel 배포, 버그 수정, 배포 URL 확인 | 배포 URL 확보 |

### 13.2 메인 프로젝트 2 고도화 방향 (04.10 ~ 04.28)

- LangGraph 고도화: AI 코치 멀티턴 대화 품질 개선, 자율 에이전트 구조 도입
- RAG 정밀도 향상: 직무 키워드 DB 확장, Re-ranking 적용
- UX 고도화: 서비스 퍼널 개선, 인터랙션 강화, 모바일 대응
- 인프라 강화: Docker + AWS 전환 검토, 유저 300명 이상 시 Supabase Pro 전환

## 14. Claude Code 개발 프롬프트

아래 핵심 구성 항목을 Claude Code 첫 메시지로 붙여넣으면 전체 프로젝트 구조를 자동 생성할 수 있다.

| 구성 항목 | 내용 요약 |
| --- | --- |
| 서비스 개요 및 기술 스택 | Gemini 단일 라인, 오버엔지니어링 금지, 무료 티어 최대 활용 원칙 명시 |
| 전체 폴더 구조 | frontend/ (Next.js), backend/ (FastAPI, chains/, rag/, routers/) |
| Supabase SQL 및 RLS | 4개 테이블 (profiles, activities, resumes, coach_sessions) + 본인 데이터만 접근 정책 |
| 환경변수 목록 | .env.local.example (프론트), .env.example (백엔드) |
| FastAPI 엔드포인트 3개 | /parse/pdf, /coach/feedback, /match/analyze - 입출력 JSON 형식 포함 |
| ChromaDB 컬렉션 구조 | job_keyword_patterns, star_examples - seed 데이터 예시 포함 |
| LangGraph CoachState | activity_text, job_title, history, rag_context, missing_elements, feedback, iteration_count |
| 구현 순서 STEP 1~5 | 세팅 → ChromaDB → 백엔드 체인 3개 → Next.js UI → 배포 |
| 코드 작성 규칙 | Python 타입 힌트, 한국어 docstring, 에러 처리, fallback 처리, API 키 환경변수 관리 |

각 STEP 완료 후 STEP N 진행해줘 입력으로 단계별 진행. 단계 완료 시 실제 작동 여부 확인 후 다음으로 넘어가는 방식이 오류를 최소화한다.
