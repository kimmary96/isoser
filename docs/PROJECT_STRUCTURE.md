# PROJECT_STRUCTURE

## 1. 현재 최상위 구조

- `frontend/`
  - Next.js 15 앱
  - 화면, BFF API, 클라이언트/서버 공용 유틸이 함께 있음
- `backend/`
  - FastAPI 앱
  - API 라우터, 추천/수집 로직, 서비스 보조 로직이 있음
- `docs/`
  - 현재 상태, 운영 규칙, 스펙, 리팩토링 기록
- `reports/`
  - 세션별 결과 보고, 검증 결과, drift/blocked 기록
- `scripts/`
  - 운영 점검, 보조 자동화 스크립트
- `supabase/`
  - 운영 메모, SQL 스냅샷, migration 초안 보관

## 2. 프론트엔드 구조

- `frontend/app/`
  - App Router 기준 페이지와 BFF API
  - `app/(landing)/programs/`: 프로그램 목록/상세/필터 UI
  - `app/api/`: 프론트 BFF와 서버 전용 처리
  - `app/dashboard/`: 로그인 사용자용 화면
- `frontend/lib/`
  - 공용 타입, API 호출 래퍼, 표시/정규화 helper
  - `lib/api/`: 백엔드/앱 API 호출 래퍼
  - `lib/server/`: 서버 전용 helper
  - `lib/types/`: 공용 타입
- `frontend/components/`
  - 라우트에 종속되지 않는 재사용 UI

### 프론트에 코드를 추가할 때 기준

- 백엔드 REST 호출 래퍼 추가: `frontend/lib/api/`
- 여러 화면에서 쓰는 표시 helper 추가: `frontend/lib/`
- 특정 페이지 전용 순수 helper 추가: 해당 라우트 폴더 내부 `*-helpers.ts`, `*-filters.ts`
- 공용 UI 추가: `frontend/components/`
- BFF API 추가: `frontend/app/api/`

## 3. 백엔드 구조

- `backend/routers/`
  - FastAPI 엔드포인트
  - `programs.py`가 프로그램 목록/상세/추천의 중심 라우터
- `backend/services/`
  - 라우터가 재사용하는 보조 로직
  - 프로그램 목록 pure helper는 `program_list_filters.py`
- `backend/schemas/`
  - 요청/응답 Pydantic 스키마
  - 현재 `programs.py`용 주요 요청/응답 모델은 `backend/schemas/programs.py`로 분리됨
- `backend/rag/`
  - 추천, 수집기, 분류, 키워드 관련 로직
- `backend/tests/`
  - 라우터/수집기/추천 로직 회귀 테스트
- `backend/venv/`
  - 로컬 백엔드 표준 가상환경 경로
- `backend/README.md`
  - 백엔드 로컬 실행/검증 기준 문서

### 백엔드에 코드를 추가할 때 기준

- 새 API 응답/요청 모델: `backend/schemas/`
- 라우터 간 공용 순수 로직: `backend/services/`
- 실제 엔드포인트 연결: `backend/routers/`
- 추천/수집 파이프라인 변경: `backend/rag/`
- 로컬 검증 명령 기준: `backend/README.md`, `scripts/run-backend-checks.ps1`

## 4. 이번 정리 이후 권장 원칙

- 프로그램 목록 관련 쿼리 파라미터 직렬화는 `frontend/lib/api/program-query.ts`를 우선 사용
- `/programs` 페이지 전용 필터/URL 정규화는 `frontend/app/(landing)/programs/page-filters.ts`에 추가
- `backend/routers/programs.py`에서 새 요청/응답 모델을 직접 정의하지 말고 `backend/schemas/programs.py`로 분리
- 대형 파일을 더 줄일 때는 라우트 본문보다 먼저 순수 helper와 스키마를 분리
