# 2026-04-02 Chroma Coach AI 작업일지

## 1. 작업 목적

오늘 작업의 목적은 `Isoser`의 Coach AI를 `ChromaDB 기반 RAG`로 안정적으로 구축하기 위한

- 요구사항 정리
- 데이터 소스 조사
- 공공데이터/파일 소스 매핑
- 환경 변수 정리
- 직무 taxonomy 1차 생성

까지를 먼저 끝내는 것이었다.

## 2. 오늘 완료한 작업

- [x] 현재 저장소의 ChromaDB 사용 범위 확인
  - 확인 결과: ChromaDB는 공통 지식 RAG 전용이며, 현재 `job_keyword_patterns`, `star_examples` 두 컬렉션만 사용 중
  - 확인 파일:
    - `backend/rag/chroma_client.py`
    - `backend/rag/seed.py`
    - `backend/chains/coach_graph.py`
    - `backend/routers/coach.py`
    - `docs/specs/prd.md`

- [x] PRD 기준 Chroma Coach AI 아키텍처/할 일 문서화
  - 작업 결과:
    - `docs/research/chroma-coach-ai-plan.md` 생성 및 보강
  - 포함 내용:
    - 현재 구현 상태
    - 목표 아키텍처
    - TODO 우선순위
    - 데이터 확보 전략
    - rewrite suggestion 방향

- [x] Chroma용 데이터 확보 전략 수립
  - 결정:
    - `job_keyword_patterns`는 워크넷/NCS/KNOW 계열을 주력 소스로 사용
    - `star_examples`는 공공데이터 자동 생성이 아니라 수동 제작/검수 방식으로 진행
  - 이유:
    - 공공데이터는 직무 설명/역량/분류에는 강하지만 STAR 교정 예시에는 직접적이지 않음

- [x] 외부/공공 데이터셋 후보 조사
  - 조사 범위:
    - NCS
    - data.go.kr
    - KOSIS/통계청
    - AI Hub
    - Hugging Face
    - Kaggle
  - 결론:
    - 한국어 Coach AI seed의 주력 데이터는 워크넷/NCS/KNOW 쪽
    - Hugging Face/Kaggle은 평가/참고용 보조 데이터에 가까움

- [x] 받은 데이터와 받지 못한 데이터 링크를 문서에 구분 반영
  - 작업 결과:
    - `docs/research/chroma-coach-ai-plan.md`에 `수신 완료`, `권한/신청 미확보`, `보조 후보` 섹션 추가

- [x] 공공 API/로컬 파일 -> Chroma seed 파이프라인 매핑 문서 작성
  - 작업 결과:
    - `docs/research/chroma-coach-ai-source-mapping.md` 생성
  - 포함 내용:
    - 환경 변수
    - 소스별 로더 제안
    - 내부 모델 정의
    - 필드 매핑 규칙
    - 파이프라인 단계

- [x] 공공 API 및 로컬 파일 경로용 env 변수명 추가
  - 수정 파일:
    - `backend/.env.example`
    - `backend/.env`
    - `backend/render.yaml`
  - 추가 변수:
    - `WORKNET_STANDARD_JOB_DESCRIPTION_API_KEY`
    - `NCS_REFERENCE_API_KEY`
    - `NCS_RESOURCE_API_KEY`
    - `WORKNET_STANDARD_JOB_DESCRIPTION_API_URL`
    - `NCS_REFERENCE_API_URL`
    - `NCS_RESOURCE_API_URL`
    - `KNOW_MID_CATEGORY_CSV_PATH`
    - `KNOW_DETAIL_CATEGORY_CSV_PATH`
    - `KNOW_SURVEY_RAW_CSV_PATH`
    - `KNOW_SURVEY_CODEBOOK_XLSX_PATH`

- [x] `normalized_job_key` 기반 직무 taxonomy 1차 구현
  - 추가 파일:
    - `backend/rag/taxonomy.py`
    - `backend/rag/build_job_taxonomy.py`
  - 생성 산출물:
    - `backend/rag/seed_data/job_taxonomy.json`
    - `backend/rag/seed_data/job_taxonomy_unmapped.json`
  - 초기 canonical 직군:
    - `pm`
    - `service_planner`
    - `backend_engineer`
    - `frontend_engineer`
    - `product_designer`
    - `marketer`

## 3. 오늘 작업 산출물

### 문서

- `docs/research/chroma-coach-ai-plan.md`
- `docs/research/chroma-coach-ai-source-mapping.md`
- `docs/worklogs/2026-04-02-chroma-coach-ai-worklog.md`

### 코드/설정

- `backend/.env.example`
- `backend/.env`
- `backend/render.yaml`
- `backend/rag/taxonomy.py`
- `backend/rag/build_job_taxonomy.py`

### 생성 데이터

- `backend/rag/seed_data/job_taxonomy.json`
- `backend/rag/seed_data/job_taxonomy_unmapped.json`

## 4. 오늘 확인한 데이터 소스 상태

### 수신 완료

- [x] 워크넷 표준직무기술서 API
- [x] NCS 기준정보 조회 API
- [x] NCS 활용자료 API
- [x] 워크넷 직업분류 CSV
- [x] 직업능력 코드매핑정보
- [x] KNOW 재직자조사 원자료/코드북

### 권한/신청 미확보

- [ ] 워크넷 채용정보 API
- [ ] 워크넷 공채속보 API
- [ ] 워크넷 직업사전 API

### 보조 후보

- [ ] AI Hub 채용면접 인터뷰 데이터
- [ ] Hugging Face resume/JD 관련 보조 데이터셋
- [ ] Kaggle job listings / resume 보조 데이터셋

## 5. 현재 TODO 체크리스트

### A. 데이터 계약 / 문서 / 준비

- [x] Chroma Coach AI 범위와 원칙 문서화
- [x] 데이터 확보 우선순위 정리
- [x] 공공데이터/외부 데이터 링크 구분 정리
- [x] 공공 API와 로컬 파일 매핑 문서 작성
- [x] 환경 변수명 고정

### B. taxonomy / 정규화

- [x] `normalized_job_key` 규칙 초안 구현
- [x] canonical 직군 1차 정의
- [x] KNOW CSV 기반 alias 매핑 1차 구현
- [x] `job_taxonomy.json` 생성기 구현
- [ ] canonical 직군 확장
- [ ] `frontend_engineer`, `pm` 계열 alias 보강
- [ ] `job_family` 세분화 규칙 보강
- [ ] `직업능력 코드매핑정보`까지 반영한 taxonomy 보강

### C. source adapter / 수집 파이프라인

- [ ] 워크넷 표준직무기술서 API 샘플 응답 저장
- [ ] NCS 기준정보 조회 API 샘플 응답 저장
- [ ] NCS 활용자료 API 샘플 응답 저장
- [ ] `source_adapters/worknet_standard_jd.py` 작성
- [ ] `source_adapters/ncs_reference.py` 작성
- [ ] `source_adapters/ncs_resources.py` 작성
- [ ] `source_adapters/know_files.py` 작성
- [ ] `source_adapters/know_survey.py` 작성

### D. 중간 산출물 생성

- [ ] `job_profile_corpus.jsonl` 생성기 구현
- [ ] `know_skill_weights.json` 생성기 구현
- [ ] `know_question_labels.json` 생성기 구현

### E. Chroma seed 생성

- [ ] `job_keyword_patterns` 자동 초안 생성기 구현
- [ ] seed metadata 계약을 코드에 반영
- [ ] `seed.py`에 taxonomy/metadata 규칙 반영
- [ ] 시드 검증 로직 추가
- [ ] 시드 버전 관리 추가

### F. Coach AI 로직

- [ ] `retrievers.py` 분리
- [ ] `coach_graph.py`에서 retrieval/prompt assembly 분리
- [ ] `section_type` 반영 검색 로직 추가
- [ ] `rewrite_suggestions` 출력 계약 반영
- [ ] Gemini 실패 fallback 구현
- [ ] 입력 검증 추가
- [ ] `coach_sessions` 저장 연결

### G. 검증 / 테스트

- [x] taxonomy 생성 스크립트 수동 실행 확인
- [ ] seed 검증 테스트 작성
- [ ] retrieval 테스트 작성
- [ ] fallback 테스트 작성
- [ ] Coach API 통합 테스트 작성

## 6. 오늘 실행한 검증

- [x] `python rag/build_job_taxonomy.py`
  - 실행 위치: `backend`
  - 결과:
    - `job_taxonomy.json` 생성
    - `job_taxonomy_unmapped.json` 생성
    - canonical taxonomy nodes 6개 생성
    - unmapped jobs 528개 생성

검증 성격:

- taxonomy 스크립트가 로컬 CSV를 읽고 JSON 산출물까지 생성하는지 확인
- alias 규칙이 최소한 일부 KNOW 직업명을 canonical 직군에 묶는지 확인

## 7. 현재 리스크

- 아직 API 실제 응답 샘플이 없어, NCS/워크넷 필드명은 문서 기준 가정 상태다.
- `frontend_engineer`, `pm`은 공공 직업명과 완전히 대응되지 않아 alias 보강이 더 필요하다.
- `star_examples`는 자동 수집 대상이 아니라 별도 제작 파이프라인이 필요하다.
- taxonomy는 아직 6개 canonical 직군만 우선 고정한 1차 버전이다.

## 8. 다음 작업 추천 순서

1. `source_adapters`를 추가하고, 받은 3개 API의 샘플 응답을 로컬에 저장한다.
2. `job_profile_corpus.jsonl` 생성기를 만든다.
3. 그 결과를 기반으로 `job_keyword_patterns` 초안 생성기로 연결한다.
