# Program Source Records Sample Backfill Helper v1

## 문서 목적

이 문서는 free plan이나 작은 테스트 DB에서 `program_source_records`를 전체 적재하지 않고도 provenance 구조를 검증할 수 있게 돕는 helper 초안을 설명한다.

핵심 문제는 기존 3단계 초안인 `20260425115000_backfill_program_source_records_from_programs.sql`가 논리적으로는 맞아도, `28225`건 전체를 넣으면 DB 용량을 빠르게 밀어 올린다는 점이다.

그래서 이번 helper는 “현재 보고 있는 샘플 프로그램만 provenance를 붙이고, 한도를 넘으면 다시 줄이는” 용도로 설계했다.

중요:

- 이 문서는 저장소 초안과 이번 세션의 실제 SQL Editor 실행 결과를 함께 기준으로 쓴다.
- helper 자체는 샘플 50건 기준으로 1차 실검증을 마쳤다.
- 다만 전체 provenance backfill을 대체하는 것은 아니므로, 여전히 `free plan용 샘플 검증 helper`로 봐야 한다.

## 대상 함수

초안 migration:

- `supabase/migrations/20260425119000_add_program_source_records_sample_backfill_helper.sql`

함수 이름:

- `public.backfill_program_source_records_sample(batch_limit, max_rows)`

## 이 함수가 하는 일

이 함수는 아래 5단계를 한 번에 수행한다.

1. 우선 `program_list_index`에 현재 들어 있는 샘플 프로그램 id를 후보로 잡는다.
2. 샘플 목록이 비어 있거나 모자라면, `programs`에서 아직 provenance 연결이 없는 최신 프로그램을 후보로 보충한다.
3. 선택된 후보 프로그램만 `program_source_records`로 backfill 한다.
4. 해당 후보 프로그램의 `primary_source_record_id`, `primary_source_code`, `primary_source_label`을 다시 연결한다.
5. 최종 row 수가 `max_rows`를 넘으면 초과 `program_source_records`를 지우고, 그 row를 참조하던 `programs.primary_source_*`도 같이 비운다.

즉, free plan에서 전체 provenance를 오래 들고 가지 않고도 “샘플 프로그램 몇 건의 source provenance가 기대대로 만들어지는지”를 볼 수 있게 하는 보조 장치다.

## 왜 필요한가

이번 세션의 실제 검증에서 아래가 확인됐다.

- `program_source_records` 전체 backfill은 논리적으로는 성공했다.
- 하지만 `raw_payload`, `normalized_snapshot`, `field_evidence`, `source_specific` JSON 때문에 용량을 빠르게 사용했다.
- 나중에 공간을 확보하려고 `primary_source_*`를 다시 비우고 `program_source_records`도 비워야 했다.

즉, free plan에서는 전체 provenance 적재보다 샘플 provenance 검증이 우선이다.

이 helper는 그 빈칸을 메우기 위한 초안이다.

## 이번 세션의 실제 검증 결과

SQL Editor에서 아래를 실제로 실행했다.

```sql
select public.backfill_program_source_records_sample(50, 50);
```

반환 요약은 아래와 같았다.

- `selected_candidate_rows = 50`
- `candidate_rows_from_program_list_index = 50`
- `candidate_rows_from_programs = 0`
- `upserted_rows = 50`
- `linked_program_rows = 50`
- `trimmed_rows = 0`
- `remaining_rows = 50`
- `remaining_linked_programs = 50`

즉, 이번 검증에서는 현재 `program_list_index` 샘플 50건을 그대로 provenance 후보로 잡아, 50건 source record를 만들고 50건 프로그램 대표 source 연결도 같이 붙였다.

샘플 확인에서도 아래가 실제로 보였다.

- `primary_source_code`가 `work24`, `kstartup`으로 채워졌다.
- `primary_source_label`은 `고용24`, `K-Startup 창업진흥원`처럼 사용자용 문구로 보였다.
- `source_record_key`는 `work24:...`, `kstartup:...`처럼 source별 안정 key 형태를 유지했다.
- `collect_method`는 `legacy-programs-sample-backfill`로 들어가 sample provenance 경로임을 구분할 수 있었다.

## 입력값

### `batch_limit`

- 이번 실행에서 새로 backfill 대상으로 잡을 최대 프로그램 수
- 기본값: `100`

### `max_rows`

- 최종적으로 `program_source_records`에 남겨둘 최대 row 수
- 기본값: `100`
- 보통 `batch_limit`와 같게 두면 이해하기 쉽다

## 반환값

이 함수는 숫자 하나가 아니라 요약 JSON을 돌려준다.

예시 항목:

- `batch_limit`
- `max_rows`
- `selected_candidate_rows`
- `candidate_rows_from_program_list_index`
- `candidate_rows_from_programs`
- `upserted_rows`
- `linked_program_rows`
- `trimmed_program_links`
- `trimmed_rows`
- `remaining_rows`
- `remaining_linked_programs`

즉, SQL Editor에서 실행하고 나서 “몇 건을 후보로 잡았고, 몇 건을 넣었고, 몇 건을 다시 비웠는지”를 한 번에 볼 수 있다.

## 어떤 프로그램을 우선 보나

현재 초안 및 1차 실검증 기준 우선순위는 아래와 같다.

1. 현재 `program_list_index`에 들어 있는 샘플 프로그램
2. 그다음 `programs` 전체에서 아직 `primary_source_record_id`가 없는 최신 프로그램

이 규칙을 둔 이유는 간단하다.

- 사용자는 보통 `program_list_index` 샘플로 카드/목록 검증을 먼저 본다.
- provenance도 같은 프로그램에 붙는 편이 상세/비교 쪽 다음 검증으로 자연스럽게 이어진다.

## 어떤 row를 남기나

현재 초안 기준으로는 아래 우선순위로 `program_source_records`를 남긴다.

1. 이번 실행에서 방금 선택한 후보 프로그램 row
2. 현재 `program_list_index` browse sample에 포함된 프로그램 row
3. 그 외 최근성이 높은 row

이 과정에서 `max_rows`를 넘는 source row는 다시 지운다.

중요한 점:

- 지워지는 source row를 `programs.primary_source_record_id`가 참조하고 있으면,
  그 프로그램의 `primary_source_*` 값도 같이 비운다.
- 즉, 이 helper는 “작은 샘플 검증용”이라는 점을 전제로 써야 한다.

## 권장 사용 예시

현재 read model 샘플 100건과 같은 크기로 provenance도 맞춰 보기:

```sql
select public.backfill_program_source_records_sample(100, 100);
```

CLI로 같은 동작 다시 실행:

```powershell
backend\venv\Scripts\python.exe scripts/backfill_program_source_records.py --batch-limit 50 --max-rows 50
```

더 보수적으로 50건만 유지:

```sql
select public.backfill_program_source_records_sample(50, 50);
```

한 번에 100건을 새로 보고, 남는 row는 150건까지 허용:

```sql
select public.backfill_program_source_records_sample(100, 150);
```

## 실행 전후에 보면 좋은 확인 쿼리

실행 전:

```sql
select
  count(*) as source_record_count,
  count(*) filter (where is_primary) as primary_source_record_count
from public.program_source_records;
```

실행 후:

```sql
select
  count(*) as source_record_count,
  count(*) filter (where is_primary) as primary_source_record_count
from public.program_source_records;
```

```sql
select
  count(*) as linked_program_count
from public.programs
where primary_source_record_id is not null;
```

```sql
select
  p.id,
  p.title,
  p.primary_source_code,
  p.primary_source_label,
  psr.source_record_key,
  psr.external_program_id,
  psr.collect_method
from public.programs p
join public.program_source_records psr
  on psr.id = p.primary_source_record_id
order by p.updated_at desc nulls last
limit 20;
```

## 비목표

이 함수는 아래를 대신하지 않는다.

- 운영 전체 provenance backfill
- collector/admin dual write 완료 상태
- `program_source_records` full retention 검증

즉, 이 helper는 “전체 구조가 맞는지 조금만 확인해 보는” free plan용 보조 함수다.

## 짧은 결론

`backfill_program_source_records_sample(...)`는 free plan 환경에서 `program_source_records`를 통째로 오래 유지하지 않고도, 현재 샘플 프로그램들에 provenance가 제대로 붙는지를 검증하기 위한 helper다.

운영 전체 backfill이 아니라, 제한된 공간에서 프로그램 축 A의 다음 검증을 계속 이어가기 위한 작은 안전장치라고 보면 된다.
