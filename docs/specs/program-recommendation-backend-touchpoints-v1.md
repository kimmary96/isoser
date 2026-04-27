# Program Recommendation Backend Touchpoints v1

기준일: 2026-04-24  
상태: proposed  
범위: 프로그램 축 A/B와 사용자 추천 축 C가 실제 backend read/write에서 만나는 변경 포인트 정리

## 1. 문서 목적

이 문서는 “어느 파일을 바꾸면 프로그램 정본 축과 사용자 추천 정본 축이 실제로 연결되는가”를 현재 저장소 기준으로 정리한 문서다.

이번 문서는 새 합의를 만드는 문서가 아니라, 이미 고정된 기준을 실제 변경 포인트와 연결하는 문서다.

## 2. 현재 저장소 기준으로 확인한 사실

- 추천/비교 핵심 로직은 현재 `backend/routers/programs.py`에 모여 있다.
- 현재 추천 read는 `_fetch_profile_row()`가 `user_recommendation_profile`을 우선 읽고, 없을 때만 legacy `profiles`로 fallback한다. `_fetch_activity_rows()`는 아직 보조 evidence read로 함께 남아 있다.
- 현재 추천 cache hash는 `_build_profile_hash()`가 `user_recommendation_profile.recommendation_profile_hash`를 우선 쓰고, 요청 단에서 `job_title` override가 있을 때만 로컬 hash를 다시 만든다.
- 현재 목록 serializer는 `_serialize_program_base_summary()`, `_serialize_program_card_summary()`, `_serialize_program_list_row_summary()` 같은 transition helper를 먼저 거쳐 summary를 조립한다.
- 현재 상세 serializer는 `programs` row만 단독 해석하지 않고 `program_source_records` primary row를 함께 읽는다.
- 현재 대시보드 추천 BFF 주 경로는 `ProgramCardItem`의 `program + context` 구조를 반환하며, `_reason`, `_fit_keywords`, `score` private field 혼합은 main path에서 제거됐다.
- 현재 프로필/이력서/활동 저장 API는 추천 파생 정본 refresh를 자동 호출한다.

## 3. 가장 먼저 바뀌어야 할 backend read 포인트

## 3.1 프로그램 목록/카드 serializer 계층

| 현재 위치 | 현재 상태 | 바뀌어야 할 방향 |
| --- | --- | --- |
| `backend/routers/programs.py::_serialize_program_list_row()` | 거대한 row를 화면용으로 직접 가공 | `serialize_program_base_summary`, `serialize_program_card_summary`, `serialize_program_list_row`로 분리 |
| `ProgramListItem` | 카드/테이블/추천 공용 monolith 타입 | `ProgramCardItem`, `ProgramListRowItem` 방향으로 분해 |
| `GET /programs`, `GET /programs/list`, `GET /programs/popular` | 사실상 같은 summary 타입을 여러 화면이 각자 다르게 소비 | `program_list_index` 명시 컬럼 기준 단일 serializer 계층으로 고정 |

핵심:

- 프로그램 축과 추천 축이 만나기 전에, 프로그램 summary가 먼저 안정돼야 한다.
- 추천은 summary를 다시 만들지 말고 이미 만든 summary에 `context`만 붙여야 한다.

## 3.2 프로그램 상세 serializer 계층

| 현재 위치 | 현재 상태 | 바뀌어야 할 방향 |
| --- | --- | --- |
| `backend/routers/programs.py::_build_program_detail_response()` | `programs` row와 `compare_meta`를 직접 해석 | `serialize_program_detail_response(program_row, source_record_row)` 구조로 분리 |
| `ProgramDetailResponse` | 현재 운영 상세 응답 타입 | 최종적으로 `summary + detail + context` 구조로 이행 |
| `GET /programs/{id}/detail` | 상세 read 전용 | `programs` 정본 + `program_source_records.source_specific` 보강 구조로 전환 |

## 3.3 추천/캘린더 추천/비교 관련도 read

| 현재 위치 | 현재 상태 | 바뀌어야 할 방향 |
| --- | --- | --- |
| `_fetch_profile_row()` | `user_recommendation_profile` 우선 + `profiles` fallback | 다음 단계에서는 legacy shape bridge를 줄이고 derived contract를 더 직접 쓰게 정리 |
| `_fetch_activity_rows()` | compare breakdown / RAG 보조 입력으로 유지 | 파생 정본 보조 evidence 범위로만 축소 유지 |
| `_build_profile_hash()` | derived hash 우선, override 시 local recompute | 이후 legacy snapshot fallback 분기 축소 |
| `/programs/recommend` | derived profile 우선 + activities + programs 조합 | 추천 BFF/context cleanup과 함께 정리 |
| `/programs/recommend/calendar` | 추천 캐시와 fallback이 섞여 있음 | 동일 파생 정본을 읽되, 캘린더 전용 정렬/context만 별도로 부여 |
| `/programs/compare-relevance` | 파생 추천 정본 우선 + activities 보조 입력 | 프로그램 canonical field 우선 계산까지 확대 |

## 4. 가장 먼저 바뀌어야 할 backend write 포인트

## 4.1 사용자 프로필/선호 저장

| 현재 위치 | 현재 쓰기 상태 | 최종 변경 포인트 |
| --- | --- | --- |
| `frontend/app/api/dashboard/profile/route.ts::PATCH` | `profiles`만 갱신 | `profiles`와 `user_program_preferences`를 역할 분리해서 저장 |
| `frontend/app/api/dashboard/profile/route.ts::PUT` | 이름/bio/address 중심 upsert | `bio`와 `target_job` 분리, 저장 후 `refresh_user_recommendation_profile()` 호출 |
| `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx` | “희망 직무”와 “한 줄 소개” 입력이 이미 분리됨 | 분리된 저장 구조 유지, legacy `bio` fallback은 점진 축소 |

고정 판단:

- `bio`는 legacy fallback이다.
- 희망 직무 정본 write는 `profiles.target_job` 또는 `user_program_preferences.target_job`로 가야 한다.

## 4.2 이력서 저장

| 현재 위치 | 현재 쓰기 상태 | 최종 변경 포인트 |
| --- | --- | --- |
| `frontend/app/api/dashboard/resume/route.ts::POST` | `resumes.target_job` 저장만 수행 | 저장 직후 `refresh_user_recommendation_profile()`을 호출해 fallback 입력을 갱신 |

주의:

- 이력서의 `target_job`는 정본 1순위가 아니라 fallback이다.
- 따라서 preference/profile target_job가 있을 때는 resume 저장이 정본을 덮으면 안 된다.

## 4.3 활동 CRUD

| 현재 위치 | 현재 쓰기 상태 | 최종 변경 포인트 |
| --- | --- | --- |
| `frontend/app/api/dashboard/activities/route.ts::POST` | 활동 생성만 수행 | 생성 후 추천 파생 정본 refresh |
| `frontend/app/api/dashboard/activities/[id]/route.ts::PATCH` | 활동 수정만 수행 | 수정 후 추천 파생 정본 refresh |
| `frontend/app/api/dashboard/activities/[id]/route.ts::DELETE` | 활동 삭제만 수행 | 삭제 후 추천 파생 정본 refresh |

이유:

- 현재 추천은 활동 키워드와 활동 스킬을 직접 읽기 때문에, 활동 CRUD는 사실상 추천 정본 write와 연결돼 있다.

## 4.4 행동 신호 write

| 현재 위치 | 현재 쓰기 상태 | 1차 판단 |
| --- | --- | --- |
| `backend/routers/bookmarks.py` | `program_bookmarks` 기록 | 1차는 기존 테이블 유지, 추천 read에서 집계 활용 |
| `frontend/app/api/dashboard/calendar-selections/route.ts::PUT` | `calendar_program_selections` 기록 | 1차는 기존 테이블 유지, 추천 read에서 집계 활용 |
| `POST /programs/{id}/detail-view` | 프로그램 인기 집계만 기록 | 1차는 프로그램 축 E 일부 반영용으로만 유지, 사용자 추천 정본에는 아직 넣지 않음 |

중요:

- 행동 신호 축 E는 이번 1차 메인 축이 아니다.
- 따라서 `program_bookmarks`, `calendar_program_selections`는 우선 “읽어서 반영”만 하고, `user_program_events` 도입은 2차로 미룬다.

## 4.5 프로그램 ingest/write

| 현재 위치 | 현재 쓰기 상태 | 최종 변경 포인트 |
| --- | --- | --- |
| `backend/routers/admin.py::_normalize_program_row()` | raw/source 값을 바로 `programs` payload로 만듦 | source payload는 `program_source_records` 기준으로 분리 |
| `backend/routers/admin.py::_upsert_program_payload*()` | `programs` direct upsert | `program_source_records` -> canonical `programs` -> `program_list_index` 순서로 전환 |
| collector/normalizer 계층 | `compare_meta`, `raw_data`, `source_unique_key`를 `programs`에 밀어 넣음 | provenance는 source record 쪽으로 이동 |

## 5. 최종 read/write 연결 순서

### 5.1 읽기

1. `program_list_index`에서 프로그램 summary를 읽는다.  
2. `user_recommendation_profile`에서 사용자 추천 정본을 읽는다.  
3. 필요한 경우 `program_bookmarks`, `calendar_program_selections`를 읽어 행동 신호를 더한다.  
4. serializer가 `program + context`를 조립한다.

### 5.2 쓰기

1. 사용자 프로필/선호/활동/이력서 변경이 발생한다.  
2. 해당 write가 끝난 뒤 `refresh_user_recommendation_profile()`를 호출한다.  
3. 추천 cache invalidation을 수행한다.  
4. 다음 추천 read는 raw profile이 아니라 파생 정본을 읽는다.

## 6. 이번 문서에서 고정하는 우선순위

### P0

- `backend/routers/programs.py`의 추천 read를 `user_recommendation_profile` 중심으로 전환
- `dashboard/profile`, `dashboard/resume`, `dashboard/activities` 저장 후 refresh 연결
- 추천 BFF가 `Program` 변형 대신 `program + context`를 받도록 구조 변경

### P1

- 북마크/캘린더 읽기 경로를 `programs` direct read에서 `program_list_index` summary read로 전환
- 비교 관련도 계산도 파생 정본 우선 구조로 이동

### P2

- collector/admin sync를 `program_source_records` 기준 dual write로 전환
- 이후 `programs`의 raw/source 혼합 컬럼 cleanup

## 7. 이번 문서에서 고정하는 판단

- 프로그램 축과 사용자 추천 축이 실제로 만나는 핵심 지점은 `backend/routers/programs.py`다.
- 추천 품질을 올리려면 모델을 바꾸는 것보다 먼저 read/write 진입점을 정리해야 한다.
- 프로필, 이력서, 활동 저장 API는 단순 CRUD가 아니라 추천 정본 갱신 트리거로 봐야 한다.
- bookmarks/calendar은 1차에서 그대로 두되, read 시 활용하는 구조로 가는 것이 맞다.
