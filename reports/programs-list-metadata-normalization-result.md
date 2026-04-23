# Programs List Metadata Normalization Result

## 1. 현재 구조 요약

- `/programs`는 상단 필터, 마감 임박 가로 레일, 전체 프로그램 테이블로 구성되어 있다.
- 전체 테이블은 `frontend/app/(landing)/programs/page.tsx`에서 렌더링한다.
- 목록 데이터는 `frontend/lib/api/backend.ts`의 `listPrograms()`가 backend `GET /programs`를 호출해 받는다.
- 기존 표시 필드는 `category`, `category_detail`, `tags`, `skills`, `participation_time`, `compare_meta`를 직접 또는 얕은 fallback으로 사용했다.

## 2. 현재 데이터 분석 결과

- 이미 존재하는 필드: `category`, `category_detail`, `tags`, `skills`, `provider`, `summary`, `description`, `start_date`, `end_date`, `teaching_method`, `support_type`, `compare_meta`, `cost_type`, `participation_time`.
- 텍스트에서 추출 가능한 필드: 대표 카테고리, 참여 시간 라벨/상세 시간, 선발 절차 라벨, keyword chip.
- 현재 없는 필드: source별 정식 `schedule_text` 목록 응답 필드, curriculum summary 전용 필드, 원본별 구조화된 선발절차 필드.
- 부트텐트 `ai` 마감임박순과 우리 `ai` 검색 결과 차이의 1차 원인은 검색 대상 차이였다. 우리 검색은 `compare_meta` 전체 JSON을 뒤져 고용24 URL의 `tracseId=AIG...`, `hrd_id`, `source_url` 같은 운영 식별자까지 `ai`로 매칭했다. 그래서 실제 내용에 AI가 없는 바리스타/ERP/포토샵 과정이 검색 결과에 섞였다.
- 부트텐트 첫 화면에 보이는 일부 고용24 과정은 우리 DB에 원본 row가 없거나, row는 있어도 명시 모집마감일/훈련시간/상세 키워드가 수집되지 않은 상태였다. 이 부분은 UI 문제가 아니라 원천 수집/백필 데이터 공백이다.

## 3. 카테고리 정규화 규칙

- `category_detail`이 있으면 먼저 대표 라벨 후보로 변환한다.
- 제목/요약/설명/tags/skills/support/teaching/compare_meta 텍스트에서 AI, 웹, 백엔드, 프론트엔드, 데이터, UX/UI, PM/기획, 클라우드, 반도체, 임베디드, 보안, 인프라 규칙을 적용한다.
- 기존 `category`는 넓은 fallback으로만 사용한다. 특히 `디자인`은 실제 디자인/UX/UI 문맥이 있을 때만 UX/UI로 표시한다.
- 정말 근거가 없을 때만 `기타`로 둔다.

## 4. 참여시간 추출 규칙

- `participation_time`이 `full-time`/`part-time`이면 먼저 라벨로 변환한다.
- 텍스트에서 요일, 시간대, 주/일 단위 학습시간을 정규식으로 찾는다.
- 09:00~18:00 계열은 `풀타임`, 18시 이후 시작은 `저녁반`, 주말 포함은 `주말반`, 자율/자유 학습은 `자율학습`, 특강/세미나는 `파트타임`으로 표시한다.
- 라벨과 상세 시간이 모두 있으면 예: `풀타임` + `월,화,수,목,금 / 09:00 ~ 18:00`처럼 함께 내려준다.

## 5. 키워드 추출 규칙

- 실제 텍스트에 있는 기술/직무/도메인/프로세스 키워드만 chip 후보로 쓴다.
- 사전 키워드와 기존 `skills`, `tags`, `compare_meta.target_job`을 합쳐 중복 제거 후 최대 8개만 내려준다.
- 짧은 영문 키워드(`AI`, `DB`, `BI`, `UI` 등)는 URL/식별자 내부 글자와 우연히 매칭되지 않도록 단어 경계가 맞는 경우만 인정한다.
- 너무 일반적인 단어(`교육`, `과정`, `프로그램`, `무료`, 지역명 등)는 chip에서 제외한다.
- `compare_meta`는 교육 내용과 직접 관련된 allowlist key만 키워드 후보에 포함한다. URL, 내부 ID, 연락처, 이메일, 만족도/정원 숫자는 검색과 키워드 추출에서 제외한다.

## 6. 수정한 파일 목록

- `backend/routers/programs.py`
- `backend/rag/collector/work24_detail_parser.py`
- `scripts/program_backfill.py`
- `backend/tests/test_programs_router.py`
- `backend/tests/test_program_backfill.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/lib/types/index.ts`
- `supabase/migrations/20260423112000_refine_programs_search_metadata.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/programs-list-metadata-normalization-result.md`

## 7. API/프론트 반영 필드 목록

- `display_categories: string[]`
- `participation_mode_label: string | null`
- `participation_time_text: string | null`
- `selection_process_label: string | null`
- `extracted_keywords: string[]`
- `compare_meta.application_deadline: string | null`
- `compare_meta.training_type: string | null`
- `compare_meta.training_time: string | null`
- `compare_meta.day_night: string | null`
- `compare_meta.weekend_text: string | null`

## 8. 샘플 프로그램 10건 전/후 비교

| # | 프로그램 | 전 | 후 |
|---|---|---|---|
| 1 | 도봉구청년창업센터 AI 창업 아카데미 | category=창업, keywords 없음 | AI서비스/PM기획, 파트타임, 현직자멘토링 |
| 2 | 자바스크립트 UI/UX웹퍼블리셔 | category=디자인, skills 없음 | 프론트엔드/UXUI, 파트타임, Java/JavaScript |
| 3 | 빅데이터 분석기사 필기 | category=IT, skills 없음 | 데이터분석, 풀타임, 데이터분석 |
| 4 | AWS 클라우드 보안 실무 | category=IT, skills 없음 | 클라우드/보안, 파트타임, 클라우드/AWS |
| 5 | 서울 관광스타트업 창업 아카데미 | category=창업 | PM/기획, 선발 절차 없음 |
| 6 | 서울여성 창업아이디어 공모전 | category=창업 | PM/기획, 선발 절차 없음 |
| 7 | 요양보호사 자격 취득과정 | category=기타 | 기타, 파트타임 |
| 8 | 서경대학교 창업보육센터 입주기업 모집 | category=창업 | PM/기획, 선발 절차 없음 |
| 9 | 게임 산업 상생 플랫폼 지원 | category=창업 | PM/기획, 선발 절차 없음 |
| 10 | K-패션 글로벌 팝업 지원 | category=창업 | PM/기획, 선발=서류 |

### 부트텐트 AI 검색 화면 기준 추가 비교

| # | 부트텐트/우리 비교 대상 | 확인 결과 | 조치 |
|---|---|---|---|
| 1 | AI PM 부트캠프 | 우리 DB 원본 row 미확인 | source coverage 후속 과제 |
| 2 | AI 융합 블렌더 광고영상편집 | 우리 DB 원본 row 미확인 | source coverage 후속 과제 |
| 3 | AI Worker 멀티미디어 콘텐츠 | 유사 고용24 row는 있으나 제목/상세 메타 차이 있음 | 키워드 사전 보강 |
| 4 | AI 디자이너 취업반 | 우리 DB 원본 row 미확인 | source coverage 후속 과제 |
| 5 | AI기반 시스템 및 응용SW 개발자 | 우리 DB 원본 row 미확인 | source coverage 후속 과제 |
| 6 | 웹앱개발 AI 서비스 엔지니어 | 우리 DB 원본 row 미확인 | source coverage 후속 과제 |
| 7 | AI 바이브코딩 자바 풀스택 | row는 있으나 모집마감/시간이 비어 모집중 목록에서 빠짐 | 명시 마감일 백필 경로 추가 |
| 8 | NVIDIA Jetson Physical AI | 우리 DB 원본 row 미확인 | source coverage 후속 과제 |
| 9 | 바리스타/ERP/포토샵이 우리 `ai` 검색에 섞임 | URL/ID의 `AIG` 때문에 오탐 | 검색 allowlist와 짧은 영문 검색 후처리로 제거 |
| 10 | 고용24 영상/디자인 AI 과정 키워드 부족 | 원문에 있는 영상/편집 도구 키워드가 사전에 부족 | PremierePro/AfterEffect/Blender/영상 편집 등 보강 |

## 9. QA 결과

- `backend/venv/Scripts/python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_program_backfill.py backend/tests/test_work24_kstartup_field_mapping.py -q`: 67 passed.
- `frontend`: `npx tsc --noEmit --project tsconfig.json`: 통과.
- `frontend`: `npm run lint`: 통과.
- 브라우저 확인: `http://127.0.0.1:3000/programs?q=ai&sort=deadline` 로드 성공, Next.js error overlay 없음, 본문 nonblank.
- 실제 API 확인: `GET /programs/count?q=ai&recruiting_only=true` 기준 13건에서 9건으로 감소했고, 바리스타/ERP/포토샵처럼 URL/ID만 `ai`에 걸리던 오탐 항목은 제외됐다.
- 실제 데이터 10건 샘플에서 AI/UX/데이터/클라우드 및 일반 창업/비IT 과정을 확인했다.
- QA 중 `AI`, `BI`, `DB`, `네트워크`, `침해` 같은 짧거나 일반적인 단어가 원본 URL/일반 문장과 매칭되는 오분류를 발견해 규칙을 보수적으로 조정했다.

## 10. 남은 한계와 후속 개선 제안

- source별 구조화된 `schedule_text`가 목록 응답에는 아직 없다. collector/normalizer에서 원본 시간표를 더 보존하면 참여 시간 정확도가 올라간다.
- 고용24 일부 프로그램은 `skills/tags`가 비어 있어 키워드 chip이 적게 표시된다. source adapter에서 curriculum/훈련목표 원문을 더 가져오는 후속 보강이 필요하다.
- 부트텐트 첫 화면과 같은 결과 개수를 만들려면 UI만으로는 부족하다. 현재 우리 DB에 없는 고용24/민간 원천 row를 추가 수집하거나, 상세 백필을 실제 운영 DB에 적용해야 한다.
- 고용24 `deadline`은 상세 HTML에 명시된 신청/모집/접수 마감일만 반영한다. 원문에 마감일이 없으면 훈련 시작일이나 종료일로 추정하지 않기 때문에 모집중 목록에서 계속 빠질 수 있다.
- 카테고리 규칙은 보수적 문자열 규칙이므로 완전한 의미 분류는 아니다. 운영 데이터 샘플을 더 모아 false positive/false negative 사전을 계속 조정해야 한다.
- 이번 작업은 표시 중심이다. 새 파생 필드는 추후 카테고리/키워드/참여시간 필터 고도화에 재사용할 수 있다.
