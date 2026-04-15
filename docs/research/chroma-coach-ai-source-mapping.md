# Chroma Coach AI 데이터 소스 매핑

## 1. 목적

이 문서는 현재 확보한 공공 API와 로컬 참조 파일을 `ChromaDB seed 생성 파이프라인`에 어떻게 연결할지 정리한 구현용 매핑 문서다.
목표는 아래 두 가지다.

- `job_keyword_patterns`를 만들기 위한 원천 데이터와 정규화 단계를 고정한다.
- `star_examples`는 공공 원천으로 직접 만들기 어렵다는 점을 분리하고, 수동 제작 경로를 명확히 한다.

## 2. 적용 범위

- 공공데이터포털
  - 한국고용정보원 직업능력 코드매핑정보
  - 한국산업인력공단 NCS 기준정보 조회 API
  - 한국산업인력공단 NCS 활용자료 API
- 고용24 OpenAPI
  - 학과정보
  - 직무정보
  - 공통코드
  - 직업정보
- 로컬 파일
  - `docs/data/직업중분류.CSV`
  - `docs/data/직업세세분류.CSV`
  - `docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_원자료.csv`
  - `docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_코드북.xlsx`

## 3. 환경 변수

| 변수명 | 용도 | 예시/기본값 |
| --- | --- | --- |
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털 공통 서비스키 | 발급받은 인증키. NCS/워크넷 계열 API는 이 값 1개로 시작 가능 |
| `WORKNET_STANDARD_JOB_DESCRIPTION_API_KEY` | 워크넷 표준직무기술서 API 전용 키. 없으면 `DATA_GO_KR_SERVICE_KEY` 사용 | 발급받은 인증키 |
| `NCS_REFERENCE_API_KEY` | NCS 기준정보 조회 API 전용 키. 없으면 `DATA_GO_KR_SERVICE_KEY` 사용 | 발급받은 인증키 |
| `NCS_RESOURCE_API_KEY` | NCS 활용자료 API 전용 키. 없으면 `DATA_GO_KR_SERVICE_KEY` 사용 | 발급받은 인증키 |
| `WORK24_MAJOR_INFO_AUTH_KEY` | 고용24 학과정보 OpenAPI `authKey` | 고용24 학과정보 서비스별 발급 키 |
| `WORK24_JOB_DUTY_AUTH_KEY` | 고용24 직무정보 OpenAPI `authKey` | 고용24 직무정보 서비스별 발급 키 |
| `WORK24_COMMON_CODES_AUTH_KEY` | 고용24 공통코드 OpenAPI `authKey` | 고용24 공통코드 서비스별 발급 키 |
| `WORK24_JOB_INFO_AUTH_KEY` | 고용24 직업정보 OpenAPI `authKey` | 고용24 직업정보 서비스별 발급 키 |
| `WORK24_OPEN_API_GUIDE_URL` | 고용24 OpenAPI 서비스 소개/신청 페이지 | `https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do` |
| `WORKNET_STANDARD_JOB_DESCRIPTION_API_URL` | 워크넷 표준직무기술서 API 안내/기준 URL | `https://www.data.go.kr/data/15088876/openapi.do` |
| `NCS_REFERENCE_API_URL` | NCS 기준정보 조회 API 안내/기준 URL | `https://www.data.go.kr/data/15128213/openapi.do` |
| `NCS_RESOURCE_API_URL` | NCS 활용자료 API 안내/기준 URL | `https://www.data.go.kr/data/15086446/openapi.do` |
| `JOB_ABILITY_CODE_MAPPING_URL` | 직업능력 코드매핑정보 파일 데이터 기준 URL | `https://www.data.go.kr/data/15154290/fileData.do` |
| `KNOW_MID_CATEGORY_CSV_PATH` | KNOW 직업 중분류 CSV 경로 | `../docs/data/직업중분류.CSV` |
| `KNOW_DETAIL_CATEGORY_CSV_PATH` | KNOW 직업 세세분류 CSV 경로 | `../docs/data/직업세세분류.CSV` |
| `KNOW_SURVEY_RAW_CSV_PATH` | KNOW 재직자조사 원자료 경로 | `../docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_원자료.csv` |
| `KNOW_SURVEY_CODEBOOK_XLSX_PATH` | KNOW 재직자조사 코드북 경로 | `../docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_코드북.xlsx` |

## 4. 최종 산출물

이 소스들은 아래 두 종류의 중간 산출물을 거쳐 최종 seed JSON으로 간다.

| 산출물 | 설명 | 최종 목적지 |
| --- | --- | --- |
| `job_taxonomy.json` | 직무 분류, 직무명 alias, NCS/KNOW 매핑 | 정규화, 검색 버킷팅 |
| `job_profile_corpus.jsonl` | 직무별 설명, 능력단위, 지식/기술/태도, 보조 지표 | `job_keyword_patterns` 생성 |
| `job_keyword_patterns.json` | Chroma seed 최종 포맷 | `job_keyword_patterns` 컬렉션 |
| `star_examples.json` | 수동 제작/검수 기반 STAR 예시 | `star_examples` 컬렉션 |

## 5. 소스별 코드 매핑 테이블

| 입력 소스 | 로더 모듈 제안 | 정규화 산출물 | 이 소스에서 가져올 핵심 정보 | 최종 사용처 |
| --- | --- | --- | --- | --- |
| 고용24 직무정보 OpenAPI | `backend/rag/source_adapters/work24_job_duty.py` | `job_profile_corpus.jsonl` | 표준직무기술서, 직무데이터사전, 직무명/직무기술 내용 | `job_keyword_patterns` 1차 원천 |
| 고용24 직업정보 OpenAPI | `backend/rag/source_adapters/work24_job_info.py` | `job_profile_corpus.jsonl` 보강 | 직업명, 직업설명, 관련 분류/탐색용 메타데이터 | 직무명 alias 보강, 코치 컨텍스트 보강 |
| 고용24 공통코드 OpenAPI | `backend/rag/source_adapters/work24_common_codes.py` | `job_taxonomy.json` 보강 | 채용/훈련 공통 코드, 직종 코드, 분류 코드 | 직무명 정규화, 코드 매핑 |
| 고용24 학과정보 OpenAPI | `backend/rag/source_adapters/work24_major_info.py` | `job_taxonomy.json` 보강 | 학과명, 학과 상세, 관련 직업/진로 탐색 메타데이터 | 직무-학과 연결, 추천/설명 보강 |
| NCS 기준정보 조회 API | `backend/rag/source_adapters/ncs_reference.py` | `job_taxonomy.json` | NCS 대/중/소/세분류, 능력단위, 능력단위 요소, 키워드 검색 결과 | 직무 taxonomy, 직무명 정규화 |
| NCS 활용자료 API | `backend/rag/source_adapters/ncs_resources.py` | `job_profile_corpus.jsonl` 보강 | 직무기술내용, 경력개발경로체계도, 직무숙련기간 | 패턴 문장 보강, 설명 다양화 |
| 직업능력 코드매핑정보 파일데이터 | `backend/rag/source_adapters/job_code_mapping.py` | `job_taxonomy.json` 보강 | NCS, KECO, 관련 직종 코드 매핑 | 서로 다른 직무 체계 정렬 |
| `docs/data/직업중분류.CSV` | `backend/rag/source_adapters/know_files.py` | `job_taxonomy.json` | KNOW 중분류 코드와 분류명 | 직군 버킷 정의 |
| `docs/data/직업세세분류.CSV` | `backend/rag/source_adapters/know_files.py` | `job_taxonomy.json` | KNOW 세세분류 코드와 직업명 | 세부 직무 alias 확장 |
| `docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_원자료.csv` | `backend/rag/source_adapters/know_survey.py` | `know_skill_weights.json` | 직업별 지식/성격/업무 관련 설문값 | 직무별 중요 역량 가중치 |
| `docs/2019년_한국직업정보(KNOW)_재직자조사_성격·지식_코드북.xlsx` | `backend/rag/source_adapters/know_survey.py` | `know_question_labels.json` | 설문 문항 의미 해석용 라벨 | KNOW 원자료 해석 |

## 6. 구현용 내부 모델

아래 내부 모델을 기준으로 각 소스를 정규화하면 구현이 단순해진다.

### 6.1 `TaxonomyNode`

| 필드 | 설명 |
| --- | --- |
| `normalized_job_key` | 내부 정규화 키. 예: `backend_engineer` |
| `display_name_ko` | 화면/문서용 직무명 |
| `aliases` | 원본 직무명/동의어 목록 |
| `job_family` | 상위 버킷. 예: `engineering`, `product` |
| `ncs_codes` | 연결된 NCS 코드 목록 |
| `know_codes` | 연결된 KNOW 코드 목록 |
| `priority` | 초기 seed 구축 우선순위 |

### 6.2 `JobProfileRaw`

| 필드 | 설명 | 주요 출처 |
| --- | --- | --- |
| `normalized_job_key` | 직무 정규화 키 | 표준직무기술서 API, NCS API |
| `source` | 원천 이름 | 모든 소스 |
| `source_id` | 원천 고유 식별자 | API/파일별 상이 |
| `title` | 직무명/자료명 | 표준직무기술서 API, NCS API |
| `summary_text` | 직무 설명 본문 | 표준직무기술서 API, NCS 활용자료 API |
| `knowledge_items` | 지식 항목 목록 | 표준직무기술서 API, KNOW |
| `skill_items` | 기술 항목 목록 | 표준직무기술서 API, KNOW |
| `attitude_items` | 태도/성향 항목 목록 | 표준직무기술서 API, KNOW |
| `ncs_units` | 능력단위명/정의 목록 | 표준직무기술서 API, NCS API |
| `career_path` | 경력개발경로 | NCS 활용자료 API |
| `experience_hint` | 숙련기간/난이도 힌트 | NCS 활용자료 API |

### 6.3 `JobKeywordPatternSeed`

| 필드 | 설명 |
| --- | --- |
| `id` | `jk:{job_slug}:{version}:{seq}` |
| `job` | 내부 정규화 키 |
| `job_family` | 상위 직군 |
| `pattern` | Chroma에 넣을 최종 문장 |
| `keywords` | 검색/설명용 핵심 키워드 |
| `source_refs` | 어떤 API/파일에서 근거를 얻었는지 |
| `lang` | `ko` |
| `version` | 시드 버전 |
| `is_active` | 활성 여부 |

## 7. 필드 매핑 규칙

정확한 응답 필드명은 API 샘플 응답을 받은 뒤 확정해야 한다. 현재는 구현 기준으로 아래 수준까지 고정한다.

| 원천 필드 그룹 | 내부 필드 | 처리 규칙 |
| --- | --- | --- |
| 직무명/분류명 | `normalized_job_key`, `display_name_ko` | alias 사전으로 정규화 |
| 직무설명/직무기술내용 | `summary_text` | 불필요한 행정 문구 제거 후 요약 단위 분리 |
| 지식/기술/태도 | `knowledge_items`, `skill_items`, `attitude_items` | 쉼표/문장 단위 split 후 중복 제거 |
| NCS 능력단위명/정의 | `ncs_units[]` | 이름과 정의를 묶어서 저장 |
| 경력개발경로/숙련기간 | `career_path`, `experience_hint` | metadata 보강용으로만 사용 |
| KNOW 설문 점수 | `know_skill_weights` | seed 생성 우선순위와 키워드 랭킹 보조에만 사용 |

## 8. 파이프라인 단계

### 단계 1. taxonomy 구축

- NCS 기준정보 조회 API에서 직무 분류를 가져온다.
- `docs/data/직업중분류.CSV`, `docs/data/직업세세분류.CSV`를 읽어 KNOW 직업명을 붙인다.
- 내부적으로 사용할 `normalized_job_key`와 alias 사전을 만든다.

### 단계 2. 직무 프로파일 수집

- 고용24 직무정보 OpenAPI를 호출해 표준직무기술서/직무데이터사전 기반 직무 설명을 수집한다.
- 고용24 직업정보 OpenAPI와 공통코드 OpenAPI로 직업명/분류 코드를 보강한다.
- NCS 활용자료 API에서 직무기술내용, 경력개발경로, 숙련기간을 보강한다.
- 결과를 `JobProfileRaw` 형태로 적재한다.

### 단계 3. KNOW 보조 가중치 생성

- KNOW 원자료 CSV를 읽고 코드북으로 문항 의미를 해석한다.
- 직업별로 자주 높은 값을 보이는 지식/성격 문항을 정리한다.
- 이 값은 seed 문장을 직접 만들기보다 `키워드 우선순위`를 조정하는 데 사용한다.

### 단계 4. `job_keyword_patterns` 생성

- `JobProfileRaw`의 `summary_text`, `knowledge_items`, `skill_items`, `ncs_units`를 기반으로 직무 핵심 표현을 추출한다.
- 추출된 정보를 사람/LLM 보조로 `이력서 bullet 스타일` 문장으로 재작성한다.
- 각 문장에 `source_refs`, `keywords`, `job_family`를 붙여 seed JSON으로 저장한다.

### 단계 5. `star_examples` 생성

- 공공 API/파일에서 직접 생성하지 않는다.
- 별도 수동 제작 워크시트에서 `original -> improved -> missing_before` 쌍을 만든다.
- 직군별 부족 패턴을 반영해 사람이 검수 후 seed JSON으로 저장한다.

## 9. 구현 우선순위

1. `env` 변수명 고정
2. `TaxonomyNode` 기준으로 직무명 정규화 사전 생성
3. API 샘플 응답 저장과 파서 작성
4. CSV/XLSX 로더 작성
5. `JobProfileRaw` 정규화 파이프라인 작성
6. `job_keyword_patterns` 초안 생성기 작성
7. 사람이 검수한 뒤 Chroma seed 반영

### 현재 구현된 산출물

- 생성 스크립트: `backend/rag/build_job_taxonomy.py`
- 생성 규칙: `backend/rag/taxonomy.py`
- 출력 파일:
  - `backend/rag/seed_data/job_taxonomy.json`
  - `backend/rag/seed_data/job_taxonomy_unmapped.json`

실행 명령:

```bash
cd backend
python rag/build_job_taxonomy.py
```

## 10. 주의사항

- 워크넷/NCS API의 정확한 응답 필드명은 샘플 응답 확인 후 코드에 상수로 고정한다.
- KNOW 원자료는 문항 코드 해석이 필요하므로 코드북과 항상 같이 읽는다.
- `star_examples`는 공공데이터에서 자동 생성하지 않는다.
- Chroma에는 사용자 원문을 넣지 않는다.
