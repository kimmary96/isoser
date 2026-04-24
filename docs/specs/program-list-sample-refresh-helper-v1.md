# Program List Sample Refresh Helper v1

## 문서 목적

이 문서는 free plan이나 작은 테스트 DB에서 `program_list_index`를 안전하게 다시 채우기 위한 helper 함수 초안을 설명한다.

핵심 문제는 기존 `refresh_program_list_index(pool_limit)`가 이름과 달리 사실상 전체 `programs`를 다시 읽어 `program_list_index`를 크게 키울 수 있다는 점이다.

그래서 이번 helper는 “조금만 채우고, 넘치면 다시 줄이는” 용도로 설계했다.

## 대상 함수

초안 migration:

- `supabase/migrations/20260425118000_add_program_list_sample_refresh_helper.sql`

함수 이름:

- `public.refresh_program_list_index_sample(batch_limit, browse_pool_limit, max_rows, keep_latest_snapshot_count)`

## 이 함수가 하는 일

이 함수는 아래 4단계를 한 번에 수행한다.

1. `refresh_program_list_delta(batch_limit)`를 한 번만 실행한다.
2. `refresh_program_list_browse_pool(browse_pool_limit)`를 실행한다.
3. `program_list_index`가 `max_rows`를 넘으면 초과 row를 다시 삭제한다.
4. 같은 `browse` / `pool_limit` 조합의 오래된 facet snapshot도 일정 개수만 남긴다.

즉, free plan에서 무심코 row 수가 계속 늘어나는 것을 막기 위한 보조 장치다.

## 왜 필요한가

이번 세션의 실제 검증에서 아래가 확인됐다.

- `program_list_index`는 다시 만들 수 있는 read model이다.
- 하지만 free plan에서 전체 refresh를 반복하면 용량을 다시 빠르게 채울 수 있다.
- 수동으로
  - `refresh_program_list_delta(50)`
  - `refresh_program_list_browse_pool(50)`
  를 따로 실행해도, 시간이 지나면 `program_list_index` row가 점점 늘 수 있다.

이 helper는 그 문제를 줄인다.

## 입력값

### `batch_limit`

- 한 번의 delta refresh에서 새로 동기화할 최대 row 수
- 기본값: `100`

### `browse_pool_limit`

- browse pool로 유지할 목표 row 수
- 기본값: `100`

### `max_rows`

- 최종적으로 `program_list_index`에 남겨둘 최대 row 수
- 기본값: `100`
- 보통 `browse_pool_limit`와 같게 두면 이해하기 쉽다

### `keep_latest_snapshot_count`

- 같은 browse pool 크기에 대해 `program_list_facet_snapshots`를 몇 개까지 남길지
- 기본값: `1`

## 반환값

이 함수는 숫자 하나가 아니라 요약 JSON을 돌려준다.

예시 항목:

- `batch_limit`
- `browse_pool_limit`
- `max_rows`
- `delta_rows`
- `browse_rows`
- `trimmed_rows`
- `trimmed_facet_snapshots`
- `remaining_rows`
- `remaining_browse_rows`

즉, SQL Editor에서 실행하고 나서 “몇 건 넣었고 몇 건 지웠는지”를 한 번에 볼 수 있다.

## 권장 사용 예시

가장 단순한 샘플 검증:

```sql
select public.refresh_program_list_index_sample(100, 100, 100, 1);
```

조금 더 보수적으로 50건만 유지:

```sql
select public.refresh_program_list_index_sample(50, 50, 50, 1);
```

browse pool은 100건으로 두고, 여유분까지 150건 유지:

```sql
select public.refresh_program_list_index_sample(100, 100, 150, 2);
```

## 어떤 row를 남기나

초안 기준으로는 아래 우선순위로 남긴다.

1. 현재 browse pool에 들어간 row
2. 광고 row
3. 클릭 인기 점수와 추천 점수가 높은 row
4. 최근 갱신된 row

즉, 목록 화면 검증에 더 쓸모 있는 row를 먼저 남기고, 샘플 한도를 넘는 row를 뒤에서 잘라낸다.

## 비목표

이 함수는 아래를 대신하지 않는다.

- 운영 전체 refresh
- 전체 `programs` 동기화
- full browse/search/archive read model 검증

따라서 이 helper는 “테스트용” 또는 “free plan용” 성격으로 이해하는 것이 맞다.

## 짧은 결론

`refresh_program_list_index_sample(...)`는 free plan 환경에서 `program_list_index`를 작게 유지하면서도 화면 계약 검증에 필요한 샘플은 다시 채울 수 있게 하는 안전장치다.

운영 전체 refresh가 아니라, 제한된 공간에서 다음 단계 검증을 계속 이어가기 위한 보조 함수라고 보면 된다.
