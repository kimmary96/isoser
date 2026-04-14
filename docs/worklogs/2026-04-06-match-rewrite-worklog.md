# 2026-04-06 Match Rewrite Chain 작업일지

## 1. 작업 목적

오늘 작업의 목적은 `Isoser` 백엔드에 `/match/rewrite` 첫 버전을 추가해, 채용 공고 본문을 기준으로 활동별 rewrite suggestion을 생성하는 흐름을 구현하는 것이었습니다.

이번 범위는 아래 4가지를 포함합니다.

- `/match/rewrite` 요청/응답 스키마 확정
- 공고 기반 활동 리라이팅 체인 구현
- Gemini/Chroma 실패 시 fallback 경로 연결
- `/match/rewrite` POST 엔드포인트 연결 및 최소 테스트 추가

핵심 원칙은 유지했습니다.

- Chroma에는 공통 지식만 사용하고 사용자 원문은 저장하지 않음
- 자동 치환 금지, suggestion만 반환
- 없는 수치/성과 생성 금지
- Gemini/Chroma 실패 시 fallback 필수

## 2. 오늘 완료한 작업

- [x] Task 1. `/match/rewrite` 요청/응답 스키마 추가
  - 작업 내용:
    - `MatchRewriteRequest`, `MatchRewriteResponse`, `ActivityRewrite`, `RewriteSuggestion` 모델 추가
    - `job_posting_text`, `job_title`, `section_type`, `suggestions` 검증 규칙 반영
    - `backend.schemas` 패키지 export 추가
  - 작업 파일:
    - `backend/schemas/match_rewrite.py`
    - `backend/schemas/__init__.py`

- [x] Task 2. 공고 기반 리라이팅 체인 구현
  - 작업 내용:
    - 활동 자동 선정 로직 추가
    - Supabase activities 조회 함수 추가
    - `job_title + section_type + activity_text + 공고 요약` 기반 retrieval query 구성
    - `job_keyword_patterns`, `star_examples`, `job_posting_snippets`를 묶는 RAG context builder 추가
    - Gemini JSON 응답 파싱 및 응답 스키마 정규화 추가
  - 작업 파일:
    - `backend/chains/job_posting_rewrite_chain.py`

- [x] Task 3. fallback 경로 및 timeout 보강
  - 작업 내용:
    - Chroma retrieval 실패 시 빈 context로 계속 진행
    - Gemini 실패/JSON 파싱 실패 시 기존 `fallback.py` 결과를 `MatchRewriteResponse` 형식으로 변환
    - LLM 호출 timeout(`GOOGLE_API_TIMEOUT_SECONDS`, 기본 20초) 추가
    - fallback suggestion 변환 시 Pydantic 모델/`dict` 양쪽을 안전하게 읽도록 보강
  - 작업 파일:
    - `backend/chains/job_posting_rewrite_chain.py`

- [x] Task 4. `/match/rewrite` POST 엔드포인트 추가
  - 작업 내용:
    - 기존 `/match/analyze` 패턴을 유지하면서 `/match/rewrite` 추가
    - 요청 바디는 `MatchRewriteRequest`, 응답은 `MatchRewriteResponse` 사용
    - 현재 저장소 패턴에 맞춰 `user_id`는 쿼리 파라미터로 수신
    - 체인 예외를 `HTTPException`으로 감싸서 API 오류 메시지 정리
  - 작업 파일:
    - `backend/routers/match.py`

- [x] Task 5. 최소 테스트 및 수동 검증 추가
  - 작업 내용:
    - 체인 단위 테스트 초안 추가
    - API 단위 테스트 초안 추가
    - `py_compile` 문법 검증 수행
    - 인라인 스크립트로 fallback 경로, 자동 활동 선정, `/match/rewrite` 성공/실패 응답 형식 확인
  - 작업 파일:
    - `backend/tests/test_job_posting_rewrite_chain.py`
    - `backend/tests/test_match_rewrite_api.py`

## 3. 오늘 작업 산출물

### 생성된 파일

- `backend/schemas/match_rewrite.py`
- `backend/schemas/__init__.py`
- `backend/chains/job_posting_rewrite_chain.py`
- `backend/tests/test_job_posting_rewrite_chain.py`
- `backend/tests/test_match_rewrite_api.py`
- `docs/worklogs/2026-04-06-match-rewrite-worklog.md`

### 수정된 파일

- `backend/routers/match.py`

## 4. 현재 TODO 체크리스트

아래 체크리스트는 `docs/research/chroma-coach-ai-plan.md` 기준 TODO 중, 오늘 작업 범위와 직접 연결되는 항목만 다시 정리한 것입니다.

### A. `/match/rewrite` 계약 / 체인 / API

- [x] `/match/rewrite` 요청/응답 스키마 정의
- [x] 활동별 rewrite suggestion 1~3개 반환 계약 고정
- [x] 공고 본문 기반 활동 자동 선정 로직 추가
- [x] JD 기반 retrieval query 조립
- [x] RAG context builder 추가
- [x] Gemini JSON 출력 파싱 및 응답 스키마 정규화
- [x] Gemini 실패 시 fallback 연결
- [x] `/match/rewrite` POST 엔드포인트 연결
- [x] 체인/API 최소 테스트 초안 추가

### B. 오늘 범위 밖이지만 바로 이어서 필요한 항목

- [ ] RAG 품질 검증 게이트 추가
- [ ] Chroma retrieval 품질 튜닝
- [ ] seed 데이터 품질 보강
- [ ] `chroma_client.py` import/init 오류 수정
- [ ] rewrite 이력의 `coach_sessions` 연동 여부 결정
- [ ] 프론트 `/match/result` 화면 연동

## 5. 리스크

- `backend/rag/chroma_client.py`에서 기존 import 경로 이슈가 있어 Chroma 초기화 시 `No module named 'rag'` 로그가 발생했습니다.
  - 영향:
    - 현재 rewrite 체인은 이 경우에도 빈 RAG context + fallback으로 동작하지만, 실제 Chroma 품질 검증은 불가능합니다.

- 정식 `pytest` 실행은 하지 못했습니다.
  - 원인:
    - `backend/.venv`와 시스템 Python 모두 `pytest`가 설치되어 있지 않았습니다.
  - 대응:
    - 테스트 파일은 추가해 두었고, 이번에는 `py_compile`과 인라인 스모크 검증으로 대신 확인했습니다.

- `main.py`는 Python 3.10 가드를 가지고 있어 현재 Python 3.11 환경에서는 전체 앱을 바로 띄워 검증하지 못했습니다.
  - 대응:
    - 라우터만 별도 `FastAPI` 앱에 붙여 `/match/rewrite` 성공/실패 응답 형식을 검증했습니다.

- PowerShell 인라인 스크립트에서 한글이 깨질 수 있어, 일부 API 스모크 테스트는 `\\u` 이스케이프 문자열로 검증했습니다.

## 6. 다음 작업 추천 순서

1. RAG 검증 게이트 추가
   - 최소 5개 시나리오로 품질 확인
   - 추천 활동 선정, suggestion focus, section, rationale가 의도대로 나오는지 점검

2. seed 품질 개선
   - 검증 결과에 따라 `job_keyword_patterns`, `star_examples`, `job_posting_snippets` 보강

3. 세션 저장 연결 여부 정리
   - rewrite 이력을 `coach_sessions`에 함께 저장할지, 별도 저장소를 둘지 결정

4. 프론트엔드 연동
   - `/match/result` 또는 후속 화면에서 `/match/rewrite` 호출
   - 사용자 선택형 suggestion 적용 UX 연결

## 7. 오늘 수행한 검증

- [x] `python -m py_compile backend/schemas/match_rewrite.py`
- [x] `python -m py_compile backend/chains/job_posting_rewrite_chain.py`
- [x] `python -m py_compile backend/routers/match.py`
- [x] LLM 강제 실패 스모크 테스트
  - 결과:
    - `fallback_used = true`
    - suggestion 3개 반환 확인

- [x] 자동 활동 선정 헬퍼 스모크 테스트
  - 결과:
    - 공고 키워드와 겹치는 활동만 선택되는 것 확인

- [x] `/match/rewrite` 인라인 API 스모크 테스트
  - 결과:
    - 성공 케이스 `200 OK`
    - 실패 케이스 `500 공고 기반 리라이팅 실패: chain failed`

- [ ] `pytest` 정식 실행
  - 미실행 사유:
    - 실행 환경에 `pytest` 미설치
