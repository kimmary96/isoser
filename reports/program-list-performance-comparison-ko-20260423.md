# 프로그램 목록 성능 비교 리포트

작성일: 2026-04-23

## 요약

이번 리팩토링으로 가장 명확하게 성능이 개선된 구간은 `/programs/filter-options`다.

기존 방식은 `programs` 원본 row를 넓게 읽고 Python에서 옵션을 추출하는 구조였고, 개선 후에는 `program_list_facet_snapshots`에 저장된 최신 facet snapshot을 읽는다. 운영 Supabase를 로컬 셸에서 3회 반복 측정한 결과, 평균 응답 시간이 약 `12.29초`에서 `0.22초`로 줄었다.

즉, filter-options 기준으로 약 `55.1배` 빨라졌고, 지연 시간은 약 `98.2%` 감소했다.

## 측정 방법

실행 명령:

```powershell
backend\venv\Scripts\python.exe scripts\benchmark_program_list_performance.py --runs 3 --limit 20 --query AI --output reports\program-list-hardening-performance-20260423.json
```

측정 기준:

- 각 케이스 3회 반복
- 로컬 개발 환경에서 운영 Supabase REST API 호출
- `ENABLE_PROGRAM_LIST_READ_MODEL=true/false`를 전환해 read model 경로와 legacy fallback 경로 비교
- 결과 원본: `reports/program-list-hardening-performance-20260423.json`

주의:

- 로컬 PC에서 Supabase까지의 네트워크 시간이 포함된다.
- legacy list 경로는 현재 운영 데이터 조건에서 `0 items / 0 count`를 반환한 케이스가 있어, 목록 조회 속도는 기능적으로 동일한 비교가 아니다.
- 따라서 “몇 배 빨라졌는지”는 기능적으로 같은 응답을 반환한 filter-options 경로를 기준으로 판단하는 것이 가장 정확하다.

## 성능 비교 표

| 구간 | 기존 방식 | 개선 방식 | 기존 평균 | 개선 평균 | 개선 배수 | 지연 감소 | 비교 판정 |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 필터 옵션 조회 | 원본 `programs` source scan + Python 추출 | `program_list_facet_snapshots` snapshot 조회 | 12,287.24ms | 222.85ms | 55.1배 빠름 | 98.2% 감소 | 유효 비교 |
| 기본 browse 목록 | legacy fallback | read model browse + promoted 분리 | 234.47ms | 1,135.36ms | 비교 제외 | 비교 제외 | legacy가 0건 반환 |
| 전체 검색 `scope=all` | legacy fallback | read model search | 227.84ms | 1,605.52ms | 비교 제외 | 비교 제외 | legacy가 0건 반환 |

## Read Model 현재 측정값

| 요청 | 평균 응답 시간 | 반환 결과 | 비고 |
| --- | ---: | --- | --- |
| 기본 browse | 1,135.36ms | organic 20건, promoted 15건, count 300 | `program_list_index`, `is_ad=false`, `browse_rank <= 300` |
| `scope=all` 검색 | 1,605.52ms | 20건, count 1000 | `scope` 컬럼 필터 제거 후 read model 유지 |
| filter-options | 222.85ms | facet options | snapshot 기반 |

## 이번 리팩토링으로 개선된 점

1. 기본 browse가 원본 상세 테이블 대신 `program_list_index`를 사용한다.
2. 필터 옵션 조회가 매 요청 source scan 대신 snapshot row 조회로 바뀌었다.
3. promoted/ad 항목은 `promoted_items`로 분리되어 organic 추천순과 섞이지 않는다.
4. Fast Campus 광고 가정은 `PROGRAM_PROMOTED_PROVIDER_MATCHES` 기반 sponsored fallback으로 구현했다.
5. promoted와 organic 중복 노출을 API 레벨에서 제거한다.
6. `scope=all` 검색이 존재하지 않는 `program_list_index.scope` 필터를 보내지 않도록 정리했다.
7. cursor 조건과 region 다중 필터가 서로 `or` 파라미터를 덮어쓰지 않도록 조합했다.

## 해석

가장 큰 체감 개선은 필터 옵션이다. 기존에는 프로그램 페이지 진입이나 필터 UI 구성 전에 원본 row를 넓게 읽는 병목이 있었고, 이번 구조에서는 snapshot 조회로 대체되어 평균 기준 약 `55배` 빨라졌다.

기본 목록은 현재 read model이 정상적으로 300개 browse pool과 promoted 15개를 반환한다. 반면 legacy fallback은 같은 조건에서 0건을 반환해 단순 시간 비교가 의미 없다. 즉, legacy가 더 빠르게 보이는 수치는 “정상 결과를 반환하지 않은 빠른 실패/빈 결과”에 가깝다.

## 남은 성능 과제

- `/programs/list` count는 아직 exact count header나 count snapshot이 아니라 id row 개수 기반이라, `scope=all` 대규모 검색에서는 더 줄일 수 있다.
- promoted fallback은 현재 설정 기반 검색이다. 실제 광고 운영 전에는 `program_promotions` 같은 campaign table과 기간/slot/rank index가 필요하다.
- 운영 DB에서 `EXPLAIN (analyze, buffers)`를 남기면 read model index 사용 여부를 더 정확히 검증할 수 있다.
- browse pool이 300보다 커질 경우 offset 기반 숫자 페이지네이션은 다시 병목이 될 수 있다.

## 결론

이번 리팩토링의 정량 성과는 filter-options 기준으로 가장 명확하다.

- 평균 `12,287.24ms` → `222.85ms`
- 약 `55.1배` 빠름
- 약 `98.2%` 지연 감소

목록 조회는 legacy 경로가 현재 동일 결과를 반환하지 않아 배수 비교에서는 제외했다. 대신 현재 read model 경로가 기본 browse, 검색, promoted 분리, organic 중복 제거를 모두 처리하는 기준 경로로 동작하는 것을 확인했다.
