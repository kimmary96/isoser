# 이소서 (Isoser) PRD

> AI 이력서 · 자기소개서 편집 서비스
> Product Requirements Document
> v1.2 | 2026-04-10

## 1. 제품 정의

### 1.1 한 줄 정의

기존 이력서 PDF에서 출발해 활동 데이터를 구조화하고, AI 코칭과 공고 매칭 분석으로 지원 문서를 빠르게 다듬는 서비스.

### 1.2 핵심 가치

- 시작 장벽 최소화: PDF 업로드 한 번으로 프로필과 활동 초안 생성
- 재사용성: 활동과 자기소개서 문항을 저장소로 누적해 재조합
- 코치형 AI: 대필보다 수정 가능한 피드백과 보완 포인트 제공
- 지원 맥락화: 공고 분석과 기업 정보 요약으로 문서 방향성 보정

## 2. 현재 제품 상태

### 2.1 구현 완료

- 인증
  - Google OAuth 로그인
  - 게스트 모드(LocalStorage 기반)
- 온보딩
  - PDF 파싱 후 `profiles`, `activities` 저장
- 대시보드
  - 프로필 통합 편집 모달
  - 이름, 희망 직무(`profiles.bio`), 이메일, 전화번호 저장
  - 프로필 이미지 업로드 + `profiles.avatar_url` 저장
  - 포트폴리오 링크 저장 + 외부 열기(`profiles.portfolio_url`)
  - 경력/학력/수상/자격증/외국어/스킬/자기소개 편집
- 활동 저장소
  - 활동 목록/상세/수정/삭제
  - STAR 항목 저장
  - 활동 상세 AI 요약 생성
- AI 코치
  - 활동 설명 기반 멀티턴 피드백
  - 코치 세션 저장, 목록 조회, 세션 복원
- 공고 매칭
  - 공고 텍스트 직접 입력
  - 이미지 다중 업로드 후 공고 텍스트 추출
  - PDF 공고 텍스트 추출
  - 활동 전체 또는 저장 이력서 기준 매칭 분석
  - 분석 결과 저장/조회/삭제
  - 기업 정보 요약 베타 제공
- 이력서 편집
  - 활동, 기술, 자기소개서 문항 선택 기반 조립
  - 생성 결과 `resumes` 저장
  - 문서 저장소 및 PDF 내보내기 연결
- 자기소개서 저장소
  - 문항 중심 목록/검색/상세 편집
  - `qa_items` 기반 문항/답변 배열 저장

### 2.2 현재 제약

- 포트폴리오 전용 편집 페이지는 아직 미구현이며 현재는 링크 저장/열기만 지원
- 이력서 템플릿 선택 UI 대비 실제 PDF 출력은 기본형 중심
- 프론트 내부 요약 API는 `GEMINI_API_KEY`가 별도로 필요
- 게스트 모드는 Supabase 영속 저장 없이 브라우저 저장소만 사용
- 백엔드는 Python 3.10.x 런타임만 허용

## 3. 타깃 사용자

- 1차: 부트캠프 수강생, 신입 취준생
- 2차: 이직 준비 재직자
- 3차: 지원 문서를 정리해야 하는 코치/멘토/리크루터

## 4. 주요 사용자 플로우

1. 로그인 또는 게스트 모드 진입
2. 온보딩에서 PDF 업로드 후 초안 생성
3. 대시보드에서 프로필과 활동 자산 정리
4. 활동 상세에서 STAR 보완 및 AI 코치 피드백 반복
5. 공고 분석 화면에서 합격률 분석 및 기업 정보 확인
6. 이력서 편집 화면에서 활동/기술/문항 선택 후 문서 생성
7. 문서 저장소에서 생성 결과 조회 및 PDF 내보내기
8. 자기소개서 저장소에서 문항별 답변 재사용/수정

## 5. 기능 요구사항

### F1. PDF 파싱 온보딩

- Input: 이력서 PDF
- Process: PDF 텍스트 추출 → LLM 구조화
- Output: `profile`, `activities` 초안 및 저장 데이터

### F2. 프로필 대시보드

- Input: 기본 정보, 포트폴리오 링크, 프로필 이미지, 경력/학력 등 리스트형 정보
- Process: `profiles` update/upsert, Storage 업로드
- Output: 대시보드 상단 카드와 상세 섹션 즉시 반영

### F3. 활동 저장소

- Input: 활동 기본 정보, 확장 정보, STAR, 공개 여부
- Process: `activities` CRUD
- Output: 활동 카드, 상세 페이지, 이력서 조립 데이터

### F4. AI 코치

- Input: 활동 설명, 목표 직무, 섹션 타입, 대화 히스토리
- Process: 피드백 생성, 리라이트 제안 생성, 세션 저장/복원
- Output: 구조 진단, 누락 요소, 제안 문장, 세션 기록

### F5. 공고 매칭 분석

- Input: 공고 텍스트, 활동 목록, 프로필 컨텍스트
- Process: 키워드/축별 점수 산정, 기업 정보 요약 조회
- Output: 총점, 등급, 상세 점수, 강점/갭, 추천 활동, 저장된 분석 이력

### F6. 이력서 생성 및 문서 저장소

- Input: 선택 활동, 선택 기술, 목표 직무, 템플릿
- Process: `resumes` 생성, 문서 저장소 목록 반영
- Output: 저장된 이력서 조회, PDF 내보내기

### F7. 자기소개서 저장소

- Input: 제목, 회사명, 직무명, 문항, 답변, 태그, QA 배열
- Process: `cover_letters` CRUD
- Output: 자기소개서 목록, 검색 결과, 상세 편집 화면

## 6. 데이터 모델 (Supabase)

주요 테이블

- `profiles`
  - `name`, `bio`, `portfolio_url`, `email`, `phone`, `education`
  - `career`, `education_history`, `awards`, `certifications`, `languages`, `skills`
  - `self_intro`, `avatar_url`
- `activities`
  - 활동 기본 필드 + STAR + 조직/기여/이미지 필드
- `resumes`
  - 이력서 버전, 타깃 직무, 선택 활동 ID 배열
- `coach_sessions`
  - 코치 대화/진단/제안 복원용 세션 데이터
- `match_analyses`
  - 매칭 점수, 키워드, 요약, 상세 payload
- `cover_letters`
  - 자기소개서 문항/답변 저장
- `portfolios`
  - 스키마 존재, 현재 코드 사용도 낮음

스토리지

- `activity-images`

## 7. API 요약

- `GET /`
- `GET /health`
- `POST /parse/pdf`
- `POST /coach/feedback`
- `GET /coach/sessions`
- `GET /coach/sessions/{session_id}`
- `POST /match/analyze`
- `POST /match/rewrite`
- `POST /match/extract-job-image`
- `POST /match/extract-job-pdf`
- `POST /company/insight`
- 프론트 내부: `POST /api/summary`

## 8. 비기능 요구사항

- RLS: 사용자 본인 데이터만 조회/수정 가능
- 게스트 대응: 비로그인 상태에서도 핵심 플로우 체험 가능
- 에러 복원력: 스키마 차이(`bio`, `analysis_payload` 등)에 대한 fallback 처리
- 성능: 대시보드, 활동 저장소, 문서 저장소 첫 로딩 지연 최소화
- 운영: Frontend(Vercel), Backend(Render), DB/SaaS(Supabase)

## 9. 마이그레이션 운영

현재 반영된 주요 마이그레이션

- `001_init_schema.sql`
- `002_add_bio_to_profiles.sql`
- `003_create_cover_letters.sql`
- `004_add_qa_items_to_cover_letters.sql`
- `20260408113000_add_portfolio_url_to_profiles.sql`

규칙

- 기존 마이그레이션 파일 수정 금지
- 변경사항은 새 SQL 파일로 추가

## 10. 다음 우선순위

1. 포트폴리오 전용 편집/공개 플로우 구현
2. 템플릿별 PDF 렌더링 실체화
3. 문서 저장소 검색/필터/정렬 강화
4. 자기소개서와 공고 분석 연결 자동화
5. 프론트 요약 API와 백엔드 AI 설정 정리

## 변경 이력

- v1.2 (2026-04-10)
  - 자기소개서 저장소 반영
  - 코치 세션 조회/복원 반영
  - 공고 이미지/PDF 추출 반영
  - 포트폴리오 링크 저장 반영
  - 현재 제약 및 우선순위 재정리
