# ChromaDB 기반 Coach AI 구축 작업 명세

## 1. 목적

이 문서는 `Isoser`의 AI 코치 기능에서 사용하는 `ChromaDB RAG` 구축 범위를 정리한 작업 명세다.
대상은 `backend/rag/`, `backend/chains/coach_graph.py`, `backend/routers/coach.py`이며, PRD의 Coach AI 요구사항을 현재 구현 상태와 비교해 우선순위 순으로 TODO를 정의한다.

이 문서가 다루는 Coach AI의 목표는 `최종본 자동 작성`이 아니라 `피드백 + 선택 가능한 rewrite suggestion 1~3개 제공`이다. 즉, 유저가 활동/경력/요약 섹션별로 직접 고칠 수 있도록 직무 맞춤 표현과 STAR 보완 포인트를 제안하는 구조를 목표로 한다.

핵심 원칙:

- ChromaDB는 공통 지식 전용으로 사용한다.
- 사용자 원본 데이터는 Supabase에 저장하고 ChromaDB에는 넣지 않는다.
- Coach AI는 Chroma 장애 시에도 최소 기능으로 동작해야 한다.
- Gemini 실패 시에도 PRD 수준의 기본 피드백을 반환할 수 있어야 한다.
- Coach AI는 최종 문장을 자동 치환하지 않고, 유저가 선택·수정할 수 있는 suggestion만 제공해야 한다.
- suggestion은 사용자 원문 사실관계를 벗어나면 안 되며, 없는 수치나 성과를 만들어내면 안 된다.

## 2. 현재 구현 상태

현재 구현된 범위:

- 서버 시작 시 `PersistentClient`로 ChromaDB를 초기화한다.
- 컬렉션은 `job_keyword_patterns`, `star_examples` 두 개만 사용한다.
- `seed.py`로 정적 JSON 시드 데이터를 적재한다.
- `coach_graph.py`에서 직무명과 활동 설명으로 Chroma 검색을 수행한다.
- Chroma 초기화/검색 실패 시 `rag_context=""`로 fallback 한다.

현재 부족한 범위:

- 시드 데이터 스키마 검증이 없다.
- 시드 버전 관리가 없다.
- 검색 필터/정규화/threshold 로직이 없다.
- PRD가 요구하는 Gemini 실패 fallback 이 없다.
- 입력 길이 검증이 없다.
- 섹션 단위(`section_type`) 문맥을 반영하는 검색/프롬프트 로직이 없다.
- `rewrite_suggestions` 출력 계약과 선택 이력 저장 구조가 없다.
- `coach_sessions` 저장 로직이 없다.
- 검색 품질과 회귀를 검증하는 테스트가 없다.

## 3. 목표 아키텍처

### 3.1 계층 구조

1. `Seed Data Layer`
   - `backend/rag/seed_data/*.json`
   - 직무 패턴과 STAR 예시를 Git에 포함된 정적 자산으로 관리

2. `Validation + Bootstrap Layer`
   - `backend/rag/seed.py`
   - Chroma 컬렉션 생성, 시드 검증, 버전 체크, 재적재 처리

3. `Chroma Gateway Layer`
   - `backend/rag/chroma_client.py`
   - 클라이언트 초기화, 컬렉션 획득, 검색 API 제공

4. `Retrieval Service Layer`
   - `backend/rag/retrievers.py` 권장
   - 직무명 정규화, top-k 조정, metadata filter, threshold 적용

5. `Prompt Assembly Layer`
   - `backend/chains/coach_graph.py`
   - 검색 결과를 프롬프트용 `rag_context`로 구성
   - `feedback + rewrite_suggestions[1..3]` 출력 형식 고정

6. `Fallback Layer`
   - `backend/rag/fallback.py` 권장
   - Gemini 실패 시 규칙 기반 기본 피드백 + suggestion 생성

7. `Conversation Persistence Layer`
   - Supabase `coach_sessions`
   - 세션 저장, iteration count 추적, suggestion 이력 저장

### 3.2 데이터 원칙

- ChromaDB 저장 대상:
  - 직무별 키워드/표현 패턴
  - STAR 예시 문장
  - 섹션별 rewrite suggestion 생성을 돕는 metadata
- ChromaDB 비저장 대상:
  - 사용자 프로필
  - 사용자 활동 원문
  - 인증/권한 정보

## 4. 컬렉션 계약

### 4.1 `job_keyword_patterns`

- 목적: 직무 맞춤 표현/키워드 패턴 검색
- document: 최종 참고 문장
- metadata 예시:

```json
{
  "job_title": "PM",
  "job_family": "product",
  "section_types": ["project", "summary"],
  "keywords": ["funnel", "retention", "ab_test"],
  "lang": "ko",
  "version": 1,
  "is_active": true
}
```

- id 규칙:
  - `jk:{job_slug}:{version}:{seq}`

### 4.2 `star_examples`

- 목적: 유사 활동 설명에 대한 STAR 예시 검색
- document: 개선된 STAR 문장
- metadata 예시:

```json
{
  "activity_type": "project",
  "section_type": "project",
  "job_family": "general",
  "original_text": "사용자 이탈이 많아 개선했다.",
  "missing_before": ["Situation", "Result"],
  "rewrite_focus": "quantification",
  "lang": "ko",
  "version": 1,
  "is_active": true
}
```

- id 규칙:
  - `se:{version}:{seq}`

### 4.3 데이터 확보 우선순위

초기 구축에서는 `잘 만든 자소서/경력기술서 원문 대량 수집`보다 아래 순서를 우선한다.

1. 직무 taxonomy 정의
2. 직무별 표현 패턴 수집 및 `job_keyword_patterns` 제작
3. STAR 교정 예시 제작 및 `star_examples` 제작
4. 검색 품질 검증 후 seed 확장
5. 이후 필요 시 익명화된 원문 사례를 참고 데이터로 보강

우선순위를 이렇게 두는 이유:

- 현재 ChromaDB 용도는 `원문 보관`이 아니라 `코치용 공통 지식 검색`이다.
- 자소서/경력기술서 원문은 저작권, 개인정보, 문체 편차 이슈가 크다.
- Coach AI는 완성 문장을 대신 써주는 것보다 `직무 맞춤 표현`과 `STAR 보완 포인트`를 제공하는 쪽이 중요하다.
- suggestion형 rewrite도 `최종본 자동 작성`이 아니라 `선택 가능한 초안 제공`으로 제한해야 PRD 원칙과 충돌하지 않는다.
- 따라서 초반에는 `패턴 데이터`와 `교정 예시`의 구조화 품질이 원문 수집량보다 더 중요하다.

### 4.4 `job_keyword_patterns` 데이터 수집 전략

#### 목적

- 특정 직무에서 자주 쓰는 표현
- 해당 직무에서 중요하게 보는 키워드
- 좋은 경력기술 bullet 패턴
- 결과 중심, 정량화 중심 문장 구조

#### 권장 수집 원천

- 공개 채용공고
- 회사 채용 페이지의 직무 소개
- 기술 블로그/팀 소개 페이지
- 공개 포트폴리오/이력서 팁 콘텐츠에서 재작성 가능한 예시

#### 초기 대상 직군

초기에는 아래 5개만 먼저 만든다.

- `pm`
- `backend_engineer`
- `frontend_engineer`
- `product_designer`
- `marketer`

#### 직군별 최소 수집 기준

- 직군별 JD 20~30개 수집
- 직군별 seed pattern 최소 10개 작성
- 중복 표현 제거
- 추상 표현보다 결과가 드러나는 문장 우선

#### 수집 절차

1. 직군명 정규화
   - 예: `백엔드 개발자`, `Backend Engineer`, `Server Developer`를 `backend_engineer`로 통일
2. 직군별 JD를 수집하고 문장을 분류
   - 책임
   - 기술 스택
   - 협업/프로세스
   - 성과/개선
3. 반복 키워드를 추출
4. 이력서 bullet 형태에 맞는 참고 문장으로 재작성
5. metadata와 함께 seed JSON으로 저장

#### 작성 원칙

- 공고 문장을 그대로 저장하지 말고 이력서 표현으로 재작성
- 추상 문장보다 행동 + 수단 + 결과가 드러나는 패턴 우선
- 가능하면 정량화가 들어간 패턴을 우선 채택
- 한 문장에 한 개의 핵심 메시지만 담기

#### JSON 템플릿

```json
{
  "job": "backend_engineer",
  "pattern": "주문 API를 비동기 처리 구조로 전환하고 캐시 전략을 적용해 평균 응답속도를 780ms에서 290ms로 개선했습니다.",
  "keywords": ["api", "비동기", "캐시", "응답속도", "성능개선"]
}
```

#### 작업 시트 템플릿

| 필드 | 설명 |
| --- | --- |
| normalized_job | 정규화된 직군명 |
| raw_source_title | 원본 공고 제목 |
| raw_source_url | 수집 출처 URL |
| source_excerpt | 참고한 원문 구절 |
| extracted_keywords | 추출 키워드 |
| rewritten_pattern | 이력서용으로 재작성한 최종 패턴 |
| quality_note | 정량화/행동동사/직무적합성 메모 |

### 4.5 `star_examples` 데이터 제작 전략

#### 목적

- 약한 활동 설명을 STAR 구조에 맞춰 어떻게 고치는지 보여주는 예시 제공
- Situation, Task, Action, Result 중 무엇이 빠졌는지 판단 근거 제공
- 정량화 전/후 차이를 예시로 제공

#### 권장 원천

- 직접 제작한 약문장 -> 개선문장 쌍
- 공개 이력서 작성 팁을 참고해 재작성한 예시
- LLM으로 초안을 만든 뒤 사람이 검수한 예시

주의:

- 공개 자소서 원문을 그대로 넣지 않는다.
- 반드시 `original`과 `improved`를 한 쌍으로 만든다.
- `missing_before`를 사람이 검수해 넣는다.

#### 초기 제작 기준

- 최소 20개
- 가능하면 40~60개까지 빠르게 확장
- 직군 일반형 + 직군 특화형을 섞어 구성
- 정량화 예시를 충분히 포함

#### 예시 유형 비율

- STAR 누락 보완형: 40%
- 정량화 보강형: 30%
- 동사/구조 개선형: 20%
- 직무 맞춤 표현 보강형: 10%

#### 제작 절차

1. 현실적인 약한 문장을 먼저 만든다.
2. 어떤 STAR 요소가 빠졌는지 표시한다.
3. 개선 문장을 작성한다.
4. 너무 과장된 수치나 허구의 표현은 제거한다.
5. 사람이 읽었을 때 실제 이력서에 넣을 수 있는 수준인지 검수한다.

#### JSON 템플릿

```json
{
  "original": "사용자 이탈이 많아서 온보딩을 개선했습니다.",
  "improved": "신규 가입자의 1주차 이탈률이 48%로 높아 온보딩 단계 축소와 안내 문구 A/B 테스트를 진행했고, 그 결과 활성화 완료율을 34%에서 57%로 개선했습니다.",
  "missing_before": ["Situation", "Result", "정량화"]
}
```

#### 작업 시트 템플릿

| 필드 | 설명 |
| --- | --- |
| category | 예시 유형 (`star_gap`, `quantification`, `verb_strength`, `job_fit`) |
| original | 약한 원문 |
| missing_before | 누락 요소 |
| improved | 개선 문장 |
| review_note | 과장 표현 여부, 실제 사용 가능성 메모 |

### 4.6 수집/제작 운영 원칙

- 원문 수집보다 `재작성/구조화`를 우선한다.
- 개인정보가 포함된 실제 이력서 원문은 초기 seed에 사용하지 않는다.
- 출처 문장을 그대로 쓰지 않고, 참고 후 내부 기준에 맞춰 다시 쓴다.
- 검색 품질은 데이터 개수보다 데이터 일관성이 더 중요하다.
- 한 번에 대량 수집하기보다 직군 5개에 대해 작은 고품질 seed를 먼저 만든다.

### 4.7 제안형 rewrite 운영 원칙

- Coach AI는 활동/경력/요약 `한 단위`에 대해 suggestion을 반환한다. 여러 섹션을 한 번에 재작성하지 않는다.
- 각 응답은 `feedback`과 별도로 `rewrite_suggestions` 1~3개를 포함한다.
- 각 suggestion은 최소한 아래 속성을 가져야 한다.
  - `text`: 유저가 바로 편집 출발점으로 삼을 수 있는 문장
  - `focus`: `star_gap | quantification | verb_strength | job_fit`
  - `rationale`: 왜 이 방향을 제안하는지 짧은 근거
- suggestion은 유저 원문에 있는 사실만 재배열/구조화해야 한다.
- retrieval metadata는 가능하면 `section_type`, `job_family`, `rewrite_focus`를 포함해 suggestion 품질을 높인다.

### 4.8 지금 당장 할 일

바로 시작할 때의 추천 순서:

1. 직군 5개 taxonomy 확정
2. 직군별 JD 20~30개 수집
3. `job_keyword_patterns` 직군별 10개씩 작성
4. `star_examples` 30개 초안 작성
5. Chroma 적재 후 Coach AI 응답 품질 점검
6. 부족한 직군/예시만 추가 확장

### 4.9 공공데이터/외부 데이터 링크 정리

아래 링크는 `job_keyword_patterns`와 `job taxonomy`를 만들기 위해 검토한 소스다.
현재 상태를 `수신 완료`, `권한/신청 미확보`, `보조 후보`로 구분한다.

#### 수신 완료 - 공공데이터포털

- 한국산업인력공단 NCS 기준정보 조회 API
  - 상태: 수신 완료
  - 용도: 직무 taxonomy, 직무명 정규화, NCS 코드 체계 정리
  - 링크: https://www.data.go.kr/data/15128213/openapi.do
- 한국산업인력공단 NCS 활용자료 API
  - 상태: 수신 완료
  - 용도: 직무기술내용, 경력개발경로, 숙련기간으로 직무 프로파일 보강
  - 링크: https://www.data.go.kr/data/15086446/openapi.do
- 직업능력 코드매핑정보
  - 상태: 파일/링크 수신 완료
  - 용도: NCS, KECO, 훈련직종 간 코드 정렬
  - 링크: https://www.data.go.kr/data/15154290/fileData.do
- 한국직업정보(KNOW) 재직자조사 원자료/코드북
  - 상태: 파일 수신 완료
  - 용도: 직업별 지식/성격 요소를 보조 가중치로 사용
  - 링크: https://www.data.go.kr/data/15114089/fileData.do
- 워크넷 직업분류 CSV
  - 상태: 파일 수신 완료
  - 용도: KNOW 기반 직업명 alias 확장, 직군 버킷 정의
  - 링크: https://www.data.go.kr/data/15119096/fileData.do

#### 수신 완료 - 고용24

- 고용24 학과정보 OpenAPI
  - 상태: 수신 완료
  - 용도: 학과명/학과 상세와 직무 연계 보강
  - 링크: https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do
- 고용24 직무정보 OpenAPI
  - 상태: 수신 완료
  - 용도: 표준직무기술서, 직무데이터사전 기반 `job_keyword_patterns` 1차 원천
  - 링크: https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do
- 고용24 공통코드 OpenAPI
  - 상태: 수신 완료
  - 용도: 직종/분류 코드 정규화
  - 링크: https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do
- 고용24 직업정보 OpenAPI
  - 상태: 수신 완료
  - 용도: 직업명/직업설명/분류 메타데이터 보강
  - 링크: https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do

#### 권한/신청 미확보

- 워크넷 채용정보 API
  - 상태: 미수신
  - 용도: 실제 채용공고 문장 패턴 수집, 직무별 표현 다양화
  - 링크: https://www.data.go.kr/data/3038225/openapi.do
- 워크넷 공채속보 API
  - 상태: 미수신
  - 용도: 최신 공채 문구/요건 패턴 수집
  - 링크: https://www.data.go.kr/data/15027228/openapi.do
- 워크넷 직업사전 API
  - 상태: 미수신
  - 용도: 직업 설명, 작업 과정, 직업 정보 보강
  - 링크: https://www.data.go.kr/data/15037284/openapi.do

#### 보조 후보

- AI Hub 채용면접 인터뷰 데이터
  - 상태: 보조 후보
  - 용도: 향후 면접 코칭 확장 참고. `star_examples` 직접 소스로는 부적합
  - 링크: https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=71592
- Hugging Face recruitment-dataset-job-descriptions-english
  - 상태: 보조 후보
  - 용도: 영문 채용공고 구조 참고, 평가/벤치마크 보조
  - 링크: https://hf.co/datasets/lang-uk/recruitment-dataset-job-descriptions-english
- Hugging Face resume-job-description-fit
  - 상태: 보조 후보
  - 용도: resume/JD 매칭 평가셋 참고
  - 링크: https://hf.co/datasets/cnamuangtoun/resume-job-description-fit
- Hugging Face resume-score-details
  - 상태: 보조 후보
  - 용도: 합성 resume/JD scoring 구조 참고
  - 링크: https://hf.co/datasets/ThanuraRukshan/resume-score-details
- Kaggle job listings dataset
  - 상태: 보조 후보
  - 용도: 공고 필드 구조 참고용
  - 링크: https://www.kaggle.com/datasets/hammadfarooq470/job-listings-dataset-for-data-analysis-and-nlp
- Kaggle resume dataset
  - 상태: 보조 후보
  - 용도: resume 파서/분류 테스트용
  - 링크: https://www.kaggle.com/datasets/jithinjagadeesh/resume-dataset

#### 적용 판단

- `job_keyword_patterns`
  - 주력: 수신 완료한 고용24/NCS/KNOW 계열
  - 보조: 미수신 워크넷 채용공고 계열, 영문 외부 데이터는 평가용
- `star_examples`
  - 공공데이터 자동 생성 금지
  - 사람이 직접 만든 `original -> improved -> missing_before` 쌍을 seed로 사용
- `job taxonomy`
  - 주력: NCS 기준정보 + KNOW 직업분류 CSV

#### 현재 키 확인 상태

- 공공데이터포털 키
  - 상태: 확인됨
  - 근거: `NCS 활용자료` 실호출에서 `HTTP 200`과 정상 XML payload 확인
- 고용24 authKey
  - 상태: 미확인
  - 사유: 현재 로컬 `backend/.env`에는 고용24 전용 `authKey`가 아직 비어 있음

## 5. 우선순위 TODO

아래 순서대로 구현한다. 앞 단계 산출물이 다음 단계 입력이 된다.

### TODO 1. Chroma 데이터 계약 고정

- 작업명: `Chroma 컬렉션/metadata 계약 정의`
- 목표:
  - `job_keyword_patterns`, `star_examples`의 필수 필드와 id 규칙 고정
  - suggestion 출력 계약까지 문서 기준으로 고정
- 해야 할 일:
  - JSON 필드명 표준화
  - metadata 필드 추가 (`section_type`, `rewrite_focus` 포함)
  - id 포맷 정의
  - `rewrite_suggestions[]` 응답 스키마 정의
- 산출물:
  - 본 문서 기준의 계약 확정
  - seed JSON 샘플 1~2건 정리
- 완료 기준:
  - `seed.py`가 어떤 필드를 기대하는지 문서와 코드가 일치

### TODO 2. 시드 데이터 검증 로직 추가

- 작업명: `Seed Data Validation`
- 목표:
  - 잘못된 JSON, 빈 텍스트, 중복 문장, 최소 개수 미달을 배포 전에 막기
- 해야 할 일:
  - `backend/rag/schema.py` 또는 `seed.py` 내부 Pydantic 검증 추가
  - 직무별 최소 10건 검증
  - STAR 예시 20건 이상 검증
  - 중복 id/중복 document 검증
- 산출물:
  - 검증 실패 시 명확한 에러 메시지
- 완료 기준:
  - 잘못된 seed 데이터에서 서버가 조용히 올라가지 않고 명시적으로 실패

### TODO 3. 시드 버전 관리 및 재적재 정책 구현

- 작업명: `Seed Versioning`
- 목표:
  - 컬렉션이 비어 있지 않아도 seed 변경을 반영할 수 있게 만들기
- 해야 할 일:
  - 컬렉션 metadata 또는 별도 manifest 파일로 버전 관리
  - 현재 버전과 목표 버전 비교
  - 구버전이면 delete/reset 후 재적재
- 산출물:
  - `SEED_VERSION` 상수 또는 manifest
- 완료 기준:
  - seed 파일 변경 시 운영 환경에서도 예측 가능한 방식으로 반영

### TODO 4. Chroma 접근 레이어 정리

- 작업명: `chroma_client.py 리팩터링`
- 목표:
  - 초기화, 컬렉션 획득, 검색 함수 책임을 분리
- 해야 할 일:
  - `init_chroma()`
  - `get_job_collection()`
  - `get_star_collection()`
  - `search_job_patterns()`
  - `search_star_examples()`
  - 예외 로깅 정리
- 산출물:
  - 읽기 쉬운 Chroma gateway API
- 완료 기준:
  - `coach_graph.py`가 컬렉션 디테일을 몰라도 됨

### TODO 5. Retrieval 품질 로직 구현

- 작업명: `Retriever Layer`
- 목표:
  - 단순 query 호출이 아니라 실제 서비스 품질을 위한 검색 조정 추가
- 해야 할 일:
  - 직무명 정규화
  - top-k 정책 설정
  - metadata filter 적용 (`section_type`, `job_family`, `rewrite_focus`)
  - similarity score threshold 도입
  - 검색 결과 후처리
- 권장 파일:
  - `backend/rag/retrievers.py`
- 완료 기준:
  - 검색 결과가 너무 빈약하거나 무관한 경우 걸러짐

### TODO 6. Coach Graph 프롬프트 조립 분리

- 작업명: `RAG Context Builder`
- 목표:
  - 검색 결과를 프롬프트 컨텍스트로 안정적으로 조합하고 suggestion 출력 형식을 고정
- 해야 할 일:
  - `rag_context` 포맷 고정
  - 직무 패턴, STAR 예시를 구분해 넣기
  - `feedback`와 `rewrite_suggestions[1..3]` 구조화 출력 계약 반영
  - 토큰 제한 대응으로 길이 절단 정책 추가
- 산출물:
  - 프롬프트 조립 함수
- 완료 기준:
  - 검색 결과 수가 늘어나도 프롬프트 형식이 깨지지 않음
  - suggestion 개수와 필드 형식이 일관되게 유지됨

### TODO 7. Gemini 실패 fallback 구현

- 작업명: `Rule-based Fallback Feedback`
- 목표:
  - PRD 요구사항대로 Gemini 실패 시에도 기본 피드백과 최소 1개 suggestion 반환
- 해야 할 일:
  - 길이 부족/정량화 부족/STAR 누락 여부를 규칙으로 점검
  - Chroma 검색 결과를 근거로 기본 피드백 문장 생성
  - 규칙 기반 rewrite suggestion 1~3개 생성
- 권장 파일:
  - `backend/rag/fallback.py`
- 완료 기준:
  - LLM 호출 실패 시 에러 문자열 대신 서비스 가능한 피드백과 suggestion 반환

### TODO 8. 입력 검증 추가

- 작업명: `Coach Input Validation`
- 목표:
  - 너무 짧은 입력에 대해 비용 낭비 없이 조기 차단
- 해야 할 일:
  - `activity_description` 최소 길이 검증
  - `job_title` 공백 처리
  - `section_type` 허용값 검증
  - `history` 타입 검증 강화
- 완료 기준:
  - PRD 요구인 `10자 미만 차단` 반영

### TODO 9. 세션 저장 구현

- 작업명: `coach_sessions Persistence`
- 목표:
  - 멀티턴 대화 이력, iteration count, suggestion 이력을 Supabase에 저장
- 해야 할 일:
  - 세션 조회/생성/업데이트 repository 추가
  - `updated_history`, `iteration_count` 저장
  - `last_suggestions` 저장
  - 필요 시 선택된 suggestion index/상태 저장
  - activity_id와 session_id 연결 규칙 정의
- 완료 기준:
  - 새 요청 전 history와 마지막 suggestion을 DB에서 복구할 수 있음

### TODO 10. 운영 로깅 및 장애 대응

- 작업명: `Observability for Coach RAG`
- 목표:
  - 검색/시드/fallback 동작 여부를 운영에서 확인 가능하게 만들기
- 해야 할 일:
  - init 성공/실패 로그
  - 시드 건수 로그
  - 검색 hit 수 로그
  - fallback 발생 로그
- 완료 기준:
  - 장애 시 원인 추적 가능

### TODO 11. 테스트 구축

- 작업명: `Coach RAG Tests`
- 목표:
  - 회귀를 막는 최소 자동화 확보
- 해야 할 일:
  - seed 검증 테스트
  - 검색 함수 테스트
  - fallback 피드백 테스트
  - suggestion 스키마 테스트
  - coach graph 단위 테스트
- 완료 기준:
  - 핵심 회귀 경로 자동 검증 가능

## 6. 파일별 작업 명세

### `backend/rag/chroma_client.py`

해야 하는 일:

- Chroma 초기화 책임 유지
- 컬렉션별 getter 유지
- 검색 함수 이름/책임 정리
- 예외를 삼키기만 하지 말고 로그를 남기기
- 검색 함수에서 `documents` 외 score/metadata 활용 가능하게 확장 고려

완료 기준:

- Chroma 접근 로직이 여기로만 모인다.

### `backend/rag/seed.py`

해야 하는 일:

- JSON 로드
- 스키마 검증
- 최소 개수 검증
- 중복 검증
- seed version 확인
- 재적재 정책 구현

완료 기준:

- 잘못된 seed 데이터가 운영에 들어가지 않는다.

### `backend/rag/schema.py` 신규 권장

해야 하는 일:

- `JobKeywordPatternSeed`
- `StarExampleSeed`
- `RewriteSuggestion`
- 검증 규칙 정의

완료 기준:

- `seed.py`가 dict 직접 파싱 대신 명시적 모델을 사용한다.

### `backend/rag/retrievers.py` 신규 권장

해야 하는 일:

- 직무명 정규화
- 검색 query 조립
- `section_type` 반영 query 조립
- top-k 정책
- threshold 정책
- 검색 결과 후처리

완료 기준:

- retrieval 품질 정책이 LangGraph 코드 밖으로 분리된다.

### `backend/rag/fallback.py` 신규 권장

해야 하는 일:

- STAR 누락 탐지
- 정량화 부족 탐지
- 규칙 기반 기본 피드백 생성
- 규칙 기반 suggestion 1~3개 생성

완료 기준:

- Gemini가 실패해도 유저에게 안내 가능한 응답을 준다.

### `backend/chains/coach_graph.py`

해야 하는 일:

- `rag_search_node`를 retrieval service 호출 방식으로 변경
- 프롬프트 조립 분리
- fallback 분기 정리
- `rewrite_suggestions`를 포함한 구조화 출력 적용
- `section_type`를 그래프 상태에 포함
- 입력 길이 검증 반영

완료 기준:

- 그래프는 orchestration 역할에 집중한다.
- 그래프 응답이 `feedback + rewrite_suggestions` 계약을 만족한다.

### `backend/routers/coach.py`

해야 하는 일:

- request validation 보강
- 세션 저장 연동
- suggestion 응답 형식 정리
- 오류 응답 형식 정리

완료 기준:

- API 계층에서 최소한의 입력 제어가 이뤄진다.

## 7. 비기능 요구사항

- 환경변수:
  - `GOOGLE_API_KEY`
  - `CHROMA_PERSIST_DIR`
  - `DATA_GO_KR_SERVICE_KEY`
  - `WORKNET_STANDARD_JOB_DESCRIPTION_API_KEY`
  - `NCS_REFERENCE_API_KEY`
  - `NCS_RESOURCE_API_KEY`
  - `WORK24_MAJOR_INFO_AUTH_KEY`
  - `WORK24_JOB_DUTY_AUTH_KEY`
  - `WORK24_COMMON_CODES_AUTH_KEY`
  - `WORK24_JOB_INFO_AUTH_KEY`
  - `KNOW_MID_CATEGORY_CSV_PATH`
  - `KNOW_DETAIL_CATEGORY_CSV_PATH`
  - `KNOW_SURVEY_RAW_CSV_PATH`
  - `KNOW_SURVEY_CODEBOOK_XLSX_PATH`
- 키 운영 원칙:
  - 공공데이터포털 `serviceKey` 1개만 확보해도 워크넷/NCS 계열은 시작 가능
  - 개별 키를 따로 발급받지 않았다면 `WORKNET_STANDARD_JOB_DESCRIPTION_API_KEY`, `NCS_REFERENCE_API_KEY`, `NCS_RESOURCE_API_KEY`에 동일한 값을 복사해 사용
  - 고용24는 공통키가 아니라 서비스별 `authKey` 4개를 각각 사용
- 배포:
  - Render 시작 시 `python rag/seed.py`가 먼저 실행되어야 함
- 보안:
  - API 키 로그 금지
  - 사용자 원문 데이터는 Chroma에 저장하지 않음
- 성능:
  - Chroma 검색은 요청당 수십 ms~수백 ms 수준 목표
  - `rag_context`는 프롬프트 토큰 제한 내에서 절단

## 8. 구현 순서 제안

1. Seed 계약 확정
2. Seed 검증/버전 관리
3. Chroma client 리팩터링
4. Retriever layer 구현
5. Coach graph 프롬프트 조립 정리
6. Gemini fallback 구현
7. 입력 검증 추가
8. 세션 저장 추가
9. 운영 로그 추가
10. 테스트 작성

## 8.1 공공데이터 연동 상세 문서

공공 API, 로컬 CSV/XLSX, Chroma seed 생성 파이프라인 사이의 상세 매핑은 아래 문서를 기준으로 구현한다.

- [chroma-coach-ai-source-mapping.md](./chroma-coach-ai-source-mapping.md)

## 9. 이번 담당 범위 정의

네 담당 범위는 아래다.

- ChromaDB 데이터 계약 확정
- seed 데이터 품질 보장
- Chroma 초기화/검색 레이어 정리
- Coach AI에서 RAG 검색 결과를 안정적으로 프롬프트에 넣는 로직 구현
- Gemini 실패 fallback 구현
- Coach AI 멀티턴 저장 로직 연결
- 테스트와 운영 로그 추가

네 담당 범위가 아닌 것:

- 프론트 UI 전체 리디자인
- PDF 파싱 모델 개선 전체
- 공고 매칭 체인 전면 재설계
- 결제/구독 모델 구현

## 10. 완료 정의

아래를 모두 만족하면 ChromaDB 기반 Coach AI 구축이 1차 완료다.

- Chroma 컬렉션 2종이 안정적으로 초기화된다.
- seed 데이터가 검증된 상태로만 적재된다.
- 검색 결과가 직무/활동 맥락에 맞게 반환된다.
- 검색 결과가 직무/활동/섹션 맥락에 맞게 반환된다.
- Coach API가 멀티턴 이력과 suggestion 이력을 유지한다.
- Coach API가 `feedback + rewrite_suggestions`를 안정적으로 반환한다.
- Gemini 실패 시에도 기본 피드백이 나온다.
- Gemini 실패 시에도 최소 1개 suggestion이 나온다.
- 핵심 경로 테스트가 존재한다.
- 운영 로그만으로 seed/init/search/fallback 상태를 추적할 수 있다.
