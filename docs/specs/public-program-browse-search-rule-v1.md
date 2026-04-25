# Public Program Browse/Search Rule v1

작성일: 2026-04-25  
대상 화면: `landing-c`, 공개 `/programs`

## 목적

공개 프로그램 노출 규칙을 아래 두 축으로 분리해 정리한다.

1. `browse pool`을 어떻게 만들 것인가
2. 어떤 경우에 `browse`가 아니라 `search`로 전환할 것인가

이 문서는 현재 구현과 사용자 제안안을 같이 비교한 뒤, 현재 프로젝트에 더 맞는 권장안을 정리한 규칙 문서다.

## 현재 구현 요약

- 기본 browse 계약은 `PROGRAM_BROWSE_POOL_LIMIT = 300`
- keyword 검색이 없고 closed/archive 모드가 아니면 `browse`
- keyword 검색이 있으면 `scope=all`, backend `search` 모드로 전환
- 현재 기본 browse pool은 `is_open=true`, `is_ad=false`, `recommended_score` 우선 + source diversity 기반
- 현재는 `2개 이상 필터면 search 전환` 규칙은 아직 없다

관련 코드:

- backend mode switch: `backend/routers/programs.py::_program_list_mode()`
- read-model browse 제한: `backend/routers/programs.py::_build_read_model_params()`
- landing/public scope helper: `frontend/lib/program-list-scope.ts`
- public fallback browse pool: `frontend/lib/server/public-programs-fallback.ts`

## 사용자 제안안

사용자 제안은 아래처럼 해석된다.

1. 당일 기준 마감된 공고 제외
2. 마감 임박 순으로 우선 후보를 본다
3. 다양성 규칙을 적용해 300건을 자른다
4. 그 300건 안에서 추천점수 기반으로 다시 나열한다
5. 랜딩과 목록의 기본 노출은 이 300건 규칙을 쓴다
6. 필터 1개만 적용되면 300건 안에서 우선 노출한다
7. 검색어가 있거나 필터가 2개 이상이면 `search` 모드로 전환하고 `browse_rank` 제한을 걸지 않는다

## 판단

### 바로 채택해도 좋은 부분

- `당일 기준 마감된 공고 제외`
  - 공개 browse의 기본 자격 조건으로 적절하다.
  - 이미 프로젝트 방향과도 일치한다.

- `필터 1개만 적용되면 300건 안에서 우선 노출`
  - browse의 의미를 유지하기 좋다.
  - landing-c의 칩 탐색과 `/programs`의 가벼운 1차 탐색에 잘 맞는다.

- `검색어가 있거나 필터가 2개 이상이면 search 모드`
  - 현재 구현보다 사용자의 탐색 의도에 더 잘 맞는다.
  - 복합 조건까지 300건 안에서만 찾게 하면 누락 체감이 커질 수 있다.

### 그대로 채택하면 애매한 부분

- `1순위 마감 임박`, `그 안에서 추천점수 기반으로 다시 300건을 나열`

이 문장은 두 규칙이 섞여 있다.

- `마감 임박 순`은 pool을 고르는 규칙인지
- 아니면 실제 화면 정렬 규칙인지

둘을 동시에 만족시키려 하면 아래 문제가 생긴다.

1. `deadline`만 강하게 우선하면 browse pool 자체가 사실상 `urgent pool`이 된다.
2. 그 뒤 화면에서는 다시 `recommended_score`로 재정렬하면, 사용자가 실제로 보는 리스트는 더 이상 `마감 임박 순`이 아니다.
3. 결국 “pool 선정 규칙”과 “표시 정렬 규칙”이 충돌한다.

즉, 이 부분은 그대로보다는 분리해서 설계하는 쪽이 맞다.

## 권장안

### 1. Pool 선정 규칙과 화면 정렬 규칙을 분리한다

`browse pool`은 “공개 첫 진입에서 보여줄 만한 300건”을 뽑는 계약이다.  
이 단계에서는 `마감`, `품질`, `다양성`을 함께 반영해야 한다.

반면 실제 화면 정렬은 surface 목적에 따라 달라질 수 있다.

- `landing-c`: 추천/발견형 성격이 강하므로 추천점수/만족도/완성도 가중치가 더 자연스럽다
- `/programs`: 탐색/지원형 성격이 강하므로 기본 정렬은 마감 임박순이 더 자연스럽다

따라서 권장 방향은 다음과 같다.

### 2. Browse Pool 선정 규칙

`0단계. 자격 필터`

- KST 기준 당일 마감된 공고 제외
- `is_ad=false` organic 후보만 기준 pool에 포함

`1단계. pool priority 계산`

순수 `deadline asc`만 쓰지 말고 아래 우선순위를 같이 반영한다.

- 우선순위 A: 마감 임박도
- 우선순위 B: 추천점수
- 우선순위 C: 품질/완성도 보조 신호
- 우선순위 D: source 다양성

실무 해석:

- `deadline`은 `후보 자격 + 우선순위 bucket`으로 강하게 쓰고
- 같은 urgency bucket 안에서는 `recommended_score`를 본다

예시 bucket:

- bucket 1: `D-0 ~ D-7`
- bucket 2: `D-8 ~ D-30`
- bucket 3: `D-31+`

그 뒤 각 bucket 내부에서:

- `recommended_score desc`
- `rating/review_count/detail completeness` 보조
- source diversity interleave

이 방식이면 `마감 임박 우선` 의도는 살리되, pool 전체가 급한 공고만으로 잠기는 문제를 줄일 수 있다.

### 3. 300건 cut 시점

`diversity 적용 후 300건 cut`이 맞다.

즉 순서는 아래가 권장된다.

1. open-only 후보 집합 생성
2. urgency bucket 부여
3. bucket 내부 추천점수 기준 정렬
4. source diversity interleave
5. 최종 300건 cut

`deadline만으로 300건 자른 뒤` diversity를 넣는 방식은 source 편향이 더 커질 수 있어 권장하지 않는다.

### 4. 화면별 기본 정렬 권장

동일한 300 browse pool을 쓰더라도 실제 노출 정렬은 surface별로 다르게 두는 편이 프로젝트에 맞다.

`landing-c`

- 기본: 추천점수/발견형 정렬
- 이유: 랜딩은 탐색 유도와 클릭 유도가 핵심

`/programs`

- 기본: 마감 임박순
- 이유: 목록은 실제 지원 행동과 비교 검토가 핵심

즉:

- `pool 선정 규칙`은 공통
- `기본 화면 정렬`은 surface별 차등

이 구조가 현재 프로젝트 목적에 가장 잘 맞는다.

## Browse/Search 전환 규칙 권장안

### Browse 유지

아래일 때는 `browse`

- keyword 없음
- active filter group 0개 또는 1개
- closed/archive 모드 아님

여기서 `active filter group`은 개별 값 개수가 아니라 그룹 기준으로 센다.

예:

- 지역 2개 선택: `regions` 1개 그룹
- 비용 + 지역: 2개 그룹
- 카테고리 + 소스 + 대상: 3개 그룹

### Search 전환

아래 중 하나면 `search`

- keyword 있음
- active filter group 2개 이상

### Archive 전환

아래면 `archive`

- `마감된 공고 보기` 체크

archive는 search보다 우선한다.

## 권장 결론

사용자 제안은 방향이 좋다. 다만 아래처럼 해석해 적용하는 것이 더 낫다.

- 채택:
  - open-only by KST
  - single filter stays inside 300 browse pool
  - keyword or 2+ filter groups switch to search mode

- 수정:
  - `deadline only -> cut 300 -> recommended_score reorder`는 그대로 쓰지 않는다
  - 대신 `urgency bucket + recommended_score + diversity`로 300 browse pool을 만든다
  - 그 pool을 surface별 기본 정렬로 다시 보여준다

## 다음 구현 시 체크리스트

- backend에서 `active filter group count`를 공용 helper로 계산할 것
- read-model browse pool builder에 urgency bucket 개념을 추가할지 검토할 것
- landing-c와 `/programs`의 기본 정렬 차이를 문서와 UI 라벨로 분리할 것
- 복합 필터 search 모드에서 count/query 비용이 커지는지 확인할 것
