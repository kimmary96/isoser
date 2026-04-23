# Program Detail Data Diagnosis Result

## 작업 이해

- 상세 페이지를 풍성하게 만들기 전에 운영 DB의 `programs` row가 실제로 어떤 상세 데이터를 이미 갖고 있는지 확인했다.
- 진단 범위는 대표 source 샘플의 기존 컬럼, `compare_meta`, 상세 API view model 매핑이다.
- 수집기, DB schema, API/UI 코드는 수정하지 않았다.

## 현재 목표

- `raw_data`, `compare_meta`, 기존 컬럼 기준으로 상세 페이지 노출 가능 데이터를 분류한다.
- 빠른 개선으로 연결 가능한 미매핑 필드를 찾는다.
- 원본 수집/백필이 필요한 source를 분리한다.

## 확인한 가정

- 실제 운영 DB 기준 `programs.raw_data` 컬럼은 존재하지 않는다. 따라서 계획서의 `raw_data` 비교는 현재 스키마에서는 수행할 수 없고, `아예 수집 안 됨` 또는 `migration 미적용`으로 분류한다.
- 실제 운영 DB 기준 `programs.application_url`, `programs.support_type`, `programs.teaching_method` 컬럼도 존재하지 않는다. 상세 API builder는 이 값들을 `compare_meta` 또는 다른 링크 컬럼에서 fallback으로 읽는 구조다.
- 현재 상세 API는 `backend/routers/programs.py`의 `_build_program_detail_response()`에서 `compare_meta` 일부와 기존 컬럼을 `ProgramDetailResponse`로 변환한다.
- 상세 UI는 `ProgramDetail`의 빈 optional 섹션을 숨기는 정책을 이미 갖고 있다.

## 대표 샘플

| source | sample id | 제목 요약 | DB 기존 컬럼 | compare_meta | 상세 응답 노출 |
| --- | --- | --- | --- | --- | --- |
| 고용24 | `4615a084-2e06-4840-98cd-b2092d8f715b` | 요양보호사 자격 취득과정 | 기관, 지역, 설명, 대상, 비용, 지원금, 링크, 운영기간, 마감 | 정원, 연락처, 이메일, 만족도, 회차/기관 id | 기관, 지역, 설명, 운영기간, 비용, 지원금, 대상, 만족도, 정원, 남은 정원, 전화 |
| 고용24 | `e929bd62-0c2d-40ce-affb-51a17245dad3` | AWS 클라우드 보안 실무 | 기관, 지역, 설명, 대상, 비용, 지원금, 링크, 운영기간, 마감 | 정원, 연락처, 이메일, 만족도, 회차/기관 id | 기관, 지역, 설명, 운영기간, 비용, 지원금, 대상, 정원, 남은 정원, 전화 |
| K-Startup | `7a2749fc-79bf-4812-9c89-f199e10876af` | 서울 관광스타트업 창업 아카데미 | 기관, 지역, 설명, 대상, 비용, 링크, 신청기간 | 신청 URL, 신청 방법, 사업유형, 문의처, 부서, 기관, 대상 상세 | 기관, 주관/부서, 지역, 설명, 신청기간, 사업유형, 링크, 비용, 대상, 담당자, 전화 |
| K-Startup | `02a62ad8-be19-484b-9b91-64e89d452720` | 구로구 창업교육 온라인 마케팅 | 기관, 지역, 설명, 대상, 비용, 링크, 신청기간 | 신청 URL, 신청 방법, 제외 대상, 사업유형, 문의처, 부서, 기관, 대상 상세 | 기관, 주관/부서, 지역, 설명, 신청기간, 사업유형, 링크, 비용, 대상, 담당자, 전화 |
| SeSAC | `dc8c34e5-86b5-4657-8eb7-a339dba07f43` | 영등포 AWS/MSA 과정 | 대상, 비용, 링크, 마감 | 없음 | 지역 fallback, 신청마감, 링크, 비용, 대상 |
| SeSAC | `182b3100-3ab4-4d0f-9468-1382a84d3d57` | 금천 AI 보안 엔지니어 과정 | 기관, 지역, 설명, 대상, 비용, 링크, 기간, 마감 | 없음 | 기관, 지역, 설명, 신청마감, 운영기간, 링크, 비용, 대상 |
| 서울일자리포털 | `ba38a89d-c856-4158-abd0-2979a43ea504` | 서울 커리업 구직지원금 | 대상, 비용, 링크, 마감 | 없음 | 지역 fallback, 신청마감, 링크, 비용, 대상 |
| SBA | `45d3c9d1-5f4a-4644-8741-d02c29d283f1` | 1인 미디어 스튜디오 협력사 | 대상, 비용, 링크, 마감 | 없음 | 지역 fallback, 신청마감, 링크, 비용, 대상 |

## 진단 결과 분류

### 이미 사용 가능

- 고용24: `provider`, `location`, `description`, `target`, `cost`, `subsidy_amount`, `source_url/link`, `start_date`, `end_date`, `deadline`.
- 고용24 `compare_meta`: `capacity`, `registered_count`, `contact_phone`, `satisfaction_score`, `source_url`.
- K-Startup: `provider`, `location`, `description`, `target`, `cost`, `source_url/link`, `start_date`, `end_date`, `deadline`.
- K-Startup `compare_meta`: `application_url`, `business_type`, `contact_phone`, `department`, `supervising_institution`, `target_age`, `target_detail`.
- SeSAC 일부 row: `provider`, `location`, `description`, `target`, `cost`, `link`, `start_date`, `end_date`, `deadline`.

### 저장됐으나 매핑 안 됨

- 고용24 `compare_meta.email`: 상세 API는 `application_method_email`만 `email`로 읽고 있어 고용24의 `email` 키는 상세 응답에 나오지 않는다.
- 고용24 `compare_meta.hrd_id`, `tracse_tme`, `trainst_cstmr_id`, `trpr_degr`, `ncs_code`, `weekend_code`: 운영/추적/분류용 값으로 저장되어 있으나 상세 페이지에는 노출되지 않는다. `ncs_code`, `weekend_code`는 사용자 친화 라벨로 가공 가능하다.
- K-Startup `compare_meta.application_method_online`, `application_method_etc`: 신청 방법 정보가 저장되어 있으나 상세 응답의 별도 `application_method` 필드가 없어 UI에서 보여주지 못한다.
- K-Startup `compare_meta.excluded_target`: 제외 대상이 저장된 row가 있으나 상세 응답 필드가 없다.
- K-Startup `compare_meta.recruiting_status`: 모집 상태가 저장되어 있으나 상세 응답에는 별도 상태로 노출되지 않는다.
- `review_count`: 상세 응답 모델에는 있으나 현재 builder에서 채우는 경로가 없다.
- `curriculum`, `faq`, `reviews`, `recommended_for`, `learning_outcomes`, `career_support`: 상세 응답 모델에는 있지만 현재 DB/`compare_meta` 샘플에서는 채워지지 않는다.

### 아예 수집 안 됨 또는 운영 스키마에 없음

- `raw_data`: 운영 DB에 컬럼이 없어 원본 API 필드 전체를 row에서 비교할 수 없다.
- SeSAC 다수 row의 `provider`, `location`, `description`, `start_date`, `end_date`, `compare_meta`: 일부 보강 row를 제외하면 목록 HTML 수준의 제목/대상/링크/마감만 남아 있다.
- 서울일자리포털, SBA, 캠퍼스타운, 50플러스 샘플: 대부분 `target`, `cost`, `link`, `deadline` 중심이고 상세 본문/기관/장소/문의처 메타가 부족하다.
- 주차별 커리큘럼, 제출 서류, 선발 절차, 준비물, 이미지, FAQ, 후기: 현재 샘플 row 기준 구조화 저장 흔적이 없다.

## 빠른 개선 후보

| 후보 | 변경 이유 | 영향 범위 | 리스크 | 테스트 포인트 | 추가 리팩토링 후보 |
| --- | --- | --- | --- | --- | --- |
| `ProgramDetailResponse.email`이 `compare_meta.email`도 읽도록 확장 | 고용24 문의 이메일이 이미 저장되어 있음 | 상세 API, 상세 UI 문의 영역 | 이메일이 기관 대표 메일인지 신청 메일인지 source별 의미 차이 | 고용24 샘플 상세 API의 `email` 반환 | source별 contact field label 분리 |
| `application_method` 필드 추가 | K-Startup 신청 방법이 이미 저장되어 있음 | 상세 API 타입, UI 신청 섹션 | 기존 응답 계약 확장 필요 | K-Startup 샘플의 온라인/기타 신청 방법 노출 | 신청 링크/방법/제출처를 `application_info` object로 묶기 |
| `excluded_target` 필드 추가 | K-Startup 제외 대상이 이미 저장되어 있음 | 상세 API 타입, UI 지원 자격 섹션 | 문장이 길 경우 UI 과밀 | 제외 대상이 있는 row만 섹션 노출 | eligibility를 대상/제외대상/연령으로 구조화 |
| `recruiting_status` 필드 추가 | K-Startup 모집 상태가 이미 저장되어 있음 | 상세 Hero/사이드바 상태 badge | 기존 날짜 기반 상태와 충돌 가능 | 날짜 상태와 source 상태 우선순위 확인 | 상태 계산 유틸 중앙화 |
| `ncs_code`, `weekend_code` 라벨화 | 고용24 훈련 분류/수강 형태 힌트가 있음 | 상세 교육 정보 섹션 | 코드 매핑표 없으면 사용자에게 난해 | 코드가 있을 때만 숨김 없이 라벨 확인 | 코드 사전/formatter 분리 |

## 추천 진행 순서

1. 무수정 진단은 완료했다.
2. 1차 상세 페이지 개선은 API 응답 확장만 최소로 진행한다.
3. 우선순위는 `email`, `application_method`, `excluded_target`, `recruiting_status`다.
4. SeSAC/서울일자리/SBA/캠퍼스타운은 현재 저장 데이터 자체가 부족하므로 source별 상세 수집 또는 백필 계획으로 분리한다.
5. `raw_data`는 운영 DB 컬럼 존재 여부부터 정리한다. 원본 전체 보존이 필요하면 migration 적용 상태와 저장 payload를 별도 task로 확인한다.

## 주의사항

- 기존 상세 API는 이미 sparse data를 숨기는 UI 정책과 연결되어 있으므로, 새 필드는 값이 있을 때만 노출해야 한다.
- source별 같은 이름의 필드라도 의미가 다를 수 있다. 예: 이메일은 신청 접수 메일일 수도 있고 기관 문의 메일일 수도 있다.
- 큰 수집기 변경 전에 상세 API view model 확장으로 이미 저장된 데이터를 먼저 노출하는 것이 가장 낮은 리스크다.

## 후속 적용 기록

### 변경 파일

- `supabase/migrations/20260423112000_refine_programs_search_metadata.sql`
- `backend/rag/collector/normalizer.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`
- `scripts/program_source_diff.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

### 변경 이유

- 운영 DB에 최신 programs metadata 컬럼이 누락된 환경에서도 search metadata migration을 적용할 수 있게 하기 위해 선행 컬럼 보강을 추가했다.
- `raw_data` 컬럼 생성 후에도 collector normalizer가 원본 `raw` payload를 넘기지 않으면 신규 수집 row에 원본 데이터가 저장되지 않으므로, 저장 payload를 연결했다.
- 후속 진단 CLI에서 DB의 `raw_data`까지 함께 비교할 수 있도록 추적 필드에 포함했다.

### 영향 범위

- 신규 수집/재수집되는 프로그램 row의 저장 payload에 `raw_data`가 포함된다.
- 기존 row는 자동으로 채워지지 않는다. 기존 row까지 채우려면 source별 backfill 또는 재수집이 필요하다.
- 상세 API/UI 응답 계약은 이번 변경으로 바꾸지 않았다.

### 리스크

- `raw_data`는 source 원본 payload 크기에 따라 DB row 저장량을 늘릴 수 있다.
- HTML collector의 원본 문자열도 `raw_data`에 들어갈 수 있으므로, 장기적으로 원본 전체 저장 범위와 보존 정책을 정해야 한다.
- 운영 DB migration 적용 순서가 환경마다 다르면 아직 다른 누락 컬럼이 추가로 발견될 수 있다.

### 테스트 포인트

- `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_scheduler_collectors.py -q`: 14 passed.
- migration 적용 후 신규 수집 또는 재수집 row에서 `raw_data is not null` 여부를 확인한다.
- `scripts/program_source_diff.py --program-id <id>`로 DB `raw_data`가 진단 출력에 포함되는지 확인한다.

### 추가 리팩토링 후보

- `raw_data` 전체 저장이 과도하면 source별 핵심 원문만 `detail_meta`로 분리하는 구조를 검토한다.
- 상세 API의 `application_method`, `excluded_target`, `recruiting_status`, `email` fallback은 별도 응답 계약 확장으로 진행한다.
