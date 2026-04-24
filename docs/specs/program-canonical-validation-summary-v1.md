# Program Canonical Validation Summary v1

## 문서 목적

이 문서는 2026년 4월 24일 기준으로 `program canonical` SQL 초안을 실제 Supabase SQL Editor에서 검증한 결과를 정리한다.

핵심 목적은 두 가지다.

- 무엇이 실제로 확인됐는지 기록한다.
- free plan 제약 때문에 어디까지 검증됐고, 어디는 아직 보류인지 분명하게 남긴다.

## 이번 검증에서 확인한 실제 상태

아래 내용은 저장소 초안과 세션 중 실제 SQL Editor 실행 결과를 함께 기준으로 정리했다.

- 저장소 기준 초안 migration은 다음 5단계로 구성됐다.
  - `20260425113000_create_program_source_records.sql`
  - `20260425114000_add_program_canonical_columns.sql`
  - `20260425115000_backfill_program_source_records_from_programs.sql`
  - `20260425116000_backfill_program_canonical_fields.sql`
  - `20260425117000_extend_program_list_index_surface_contract.sql`
- 실제 Supabase DB는 UTC 세션 날짜를 사용하고 있었다.
  - SQL 출력 기준 `current_date = 2026-04-23`
  - 같은 시점의 한국 날짜는 `2026-04-24`
- free plan 한도는 이미 초과된 상태였다.
  - Usage 화면 기준 DB size는 약 `0.59 / 0.5 GB`
- 실제 용량 상위 테이블은 아래 두 개였다.
  - `public.programs`: 약 `275 MB`
  - `public.program_list_index`: 약 `186 MB`

## 단계별 검증 결과

### 1단계. `program_source_records` 구조 추가

구조 생성 자체는 초안 기준으로 정리됐다.

- `program_source_records` 테이블, helper 함수, trigger, policy 이름이 의도한 형태로 잡히는 초안을 만들었다.
- 다만 이 단계는 구조 생성보다 이후 3단계의 대량 데이터 적재가 더 큰 운영 리스크로 확인됐다.

### 2단계. `programs` canonical 컬럼 추가

additive 컬럼 추가 방향은 유지 가능하다고 판단했다.

- `primary_source_*`
- `provider_name`, `summary_text`, `detail_url`
- `application_start_date`, `application_end_date`
- `program_start_date`, `program_end_date`
- `deadline_confidence`
- 기타 상세 응답용 정본 후보 컬럼

이 단계는 기존 동작을 깨지 않고 붙일 수 있는 구조로 유지됐다.

### 3단계. `program_source_records` 전체 backfill

초기 실행 결과 자체는 성공이었다.

- 실제 SQL 결과:
  - `total_programs = 28225`
  - `total_source_records = 28225`
  - `primary_source_records = 28225`
  - `linked_programs = 28225`
  - `source_code_filled_programs = 28225`

즉, 논리적으로는 프로그램 1건당 source record 1건이 모두 연결됐다.

하지만 운영 판단은 `조건부 보류`다.

- 이유:
  - free plan DB 용량을 즉시 압박했다.
  - `program_source_records`는 `raw_payload`, `normalized_snapshot`, `source_specific`, `field_evidence` 같은 JSON 데이터를 함께 담아 상대적으로 무겁다.
- 실제 대응:
  - 테스트 DB에서는 `primary_source_*` 값을 다시 비우고 `program_source_records`도 비워 용량을 확보했다.

정리하면, 3단계는 “논리 검증은 통과”, “free plan 운영 검증은 보류” 상태다.

### 4단계. `programs` canonical field backfill

초기 검증 결과는 아래와 같았다.

- `total_programs = 28225`
- `provider_filled = 28046`
- `summary_filled = 0`
- `application_end_date_filled = 28177`
- `program_period_filled = 28046`
- `target_summary_filled = 28225`
- `detail_url_filled = 28046`
- `broken_primary_source_refs = 0`

이 결과에서 중요한 해석은 아래와 같다.

- `application_end_date`, `program period`, `detail_url`, `target_summary`는 대부분 정상적으로 채워졌다.
- 깨진 참조도 없었다.
- 다만 `summary_text`가 전부 비어 있었다.

이후 초안을 보정했다.

- `summary_text`는 `summary`만 보지 않고 `description` 앞 280자도 fallback으로 쓰게 수정했다.

최종 판단:

- 4단계는 통과
- 단, `summary -> description 280자 fallback` 보정이 반영된 최신 초안 기준으로 보는 것이 맞다

### 5단계. `program_list_index` surface contract 확장

이 단계는 두 번 나눠 봐야 한다.

#### 5-1. 구조 검증

처음에는 `program_list_index`를 용량 확보를 위해 비워둔 상태였기 때문에, 결과 row가 `0`으로 나왔다.

이것은 실패가 아니라, “빈 read model 위에 계약 컬럼과 trigger만 얹힌 상태”였다.

#### 5-2. 샘플 재적재 검증

free plan 제약 때문에 전체 refresh 대신 샘플 100건만 다시 넣어 검증했다.

- `program_list_index_rows = 100`

샘플 100건에서 아래 필드는 기대대로 채워졌다.

- `source_code`
- `provider_name`
- `primary_link`
- `detail_path`
- `compare_path`
- `cost_label`

처음에는 모집 상태가 일부 틀렸다.

- 예:
  - `application_end_date = 2026-01-25`인데 `open`
  - `application_end_date = 2026-04-23`인데 `closing_soon`

원인은 두 가지였다.

- legacy `is_open`, `days_left`를 canonical 날짜보다 먼저 믿던 계산 순서
- DB 세션 날짜가 UTC라서 한국 날짜와 하루 차이가 나던 시간대 문제

그래서 초안을 두 번 보정했다.

- 모집 상태는 `application_end_date`를 우선 사용
- 기준 날짜는 `current_date` 대신 `timezone('Asia/Seoul', now())::date` 사용

최종 재검증 결과:

- SQL 출력 기준
  - `db_current_date = 2026-04-23`
  - `kst_date = 2026-04-24`
  - `current_setting('TimeZone') = UTC`
- 그 상태에서도 `application_end_date <= 2026-04-23` row가 모두 `closed`로 나왔다

이로써 5단계 샘플 검증은 통과로 본다.

## 이번 검증으로 확정해도 되는 것

- `programs`에 canonical 컬럼을 additive로 붙이는 방향은 유지 가능하다.
- `application_end_date`는 모집 상태 계산의 정본 날짜로 삼아야 한다.
- 모집 상태 같은 사용자 표시값은 한국 서비스 기준 시간대(KST)를 명시해야 안전하다.
- `program_list_index`는 화면 계약용 read model로 계속 쓸 수 있다.
- `source_code`, `provider_name`, `primary_link`, `detail_path`, `compare_path`, `cost_label`은 샘플 기준으로 계약에 맞게 채워졌다.

## 아직 보류로 남겨야 하는 것

- free plan DB에서는 `program_source_records` 전체 backfill을 장기 유지하기 어렵다.
- `refresh_program_list_index(pool_limit)`는 이름과 달리 사실상 전체 `programs`를 다시 채우는 구조라 free plan에서 위험하다.
- 전체 `28225`건에 대한 full read-model refresh 검증은 아직 하지 않았다.
- 테스트 DB 기준 현재 `program_list_index`는 샘플 100건 수준만 다시 채운 상태다.
- 테스트 DB 기준 `program_source_records`는 한 번 비운 뒤, 이후 `backfill_program_source_records_sample(50, 50)`로 샘플 50건만 다시 채운 상태까지 확인했다.

## 추가로 만든 다음 검증용 helper 초안

이번 세션 끝부분에는 free plan에서 3단계를 다시 조금씩 검증할 수 있도록 추가 helper 초안을 더 만들었다.

- `20260425118000_add_program_list_sample_refresh_helper.sql`
  - 이미 실제 Supabase DB에서 샘플 100건 기준으로 동작을 확인했다.
- `20260425119000_add_program_source_records_sample_backfill_helper.sql`
  - `program_list_index` 샘플 프로그램을 우선 대상으로 provenance를 조금만 다시 채우는 helper다.

중요한 차이가 있다.

- `refresh_program_list_index_sample(...)`는 실제 DB에서 샘플 실행까지 확인됐다.
- `backfill_program_source_records_sample(...)`도 실제 DB에서 `50건 후보 -> 50건 upsert -> 50건 primary source 연결`까지 확인됐다.

즉, read model sample helper와 provenance sample helper 모두 1차 샘플 검증은 통과했다.

## 다음 단계 권장안

### 권장안 A. 문서/설계 확정 기준으로 마감

지금 세션 결과만으로도 아래는 충분히 문서화할 수 있다.

- 4단계 canonical backfill 기준
- 5단계 surface contract 계산 기준
- KST 기준 모집 상태 계산 규칙
- free plan 운영 한계와 우회 방식

추가로, 이후 free plan에서 검증을 조금 더 이어갈 경우를 위해 아래 두 helper를 같이 두는 것이 안전하다.

- `refresh_program_list_index_sample(...)`
- `backfill_program_source_records_sample(...)`

### 권장안 B. 새 DB 또는 유료 플랜에서 전체 검증

아래가 필요하면 새 프로젝트나 유료 플랜에서 이어가는 것이 안전하다.

- `program_source_records` full backfill 유지
- `program_list_index` full refresh
- 전체 browse/search/archive read model 검증

## 짧은 결론

이번 검증의 최종 판단은 아래와 같다.

- 프로그램 canonical 초안은 방향이 맞다.
- 4단계와 5단계는 샘플 실검증 기준 통과다.
- 3단계 provenance full backfill과 5단계 full read-model refresh는 free plan 용량 때문에 운영 보류가 맞다.
- 따라서 다음 실무 기준은 “설계 확정은 가능, 전체 적재는 더 넉넉한 DB에서 진행”이다.
