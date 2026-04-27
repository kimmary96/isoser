# Refactoring Summary

## 작업 목적

- Work24 전국 수집 또는 지역 필터 확장 시 프로그램 `region`/`region_detail`이 collector source meta의 서울 기본값에 고정되는 문제를 줄인다.
- 운영자가 Work24 목록 API 필터 env/query를 안전하게 조합할 수 있도록 문서화한다.

## 리팩토링 전 문제점

- Work24 scheduler는 기본 source meta가 `서울`이라, 전국 수집으로 전환할 경우 row 주소가 다른 지역이어도 `programs.region`이 서울로 저장될 수 있었다.
- admin sync adapter도 `location`만 저장하고 `region`/`region_detail`은 명시적으로 채우지 않았다.
- Work24 관련 env 이름이 코드에는 있었지만 별도 운영 문서가 없어 설정 조합을 재사용하기 어려웠다.

## 실제 변경 사항

### 파일별 변경

- `backend/rag/collector/program_field_mapping.py`
  - Work24 `address`와 `trngAreaCd` 기반 `derive_korean_region` helper를 추가했다.
  - `map_work24_training_item`이 `region`, `region_detail`, `compare_meta.address`, `compare_meta.trng_area_code`를 보존하도록 했다.
- `backend/rag/collector/normalizer.py`
  - source meta보다 raw item의 `region`/`region_detail`을 우선 보존하도록 했다.
- `backend/rag/source_adapters/work24_training.py`
  - admin sync adapter normalized row에도 `region`/`region_detail`을 추가했다.
- `backend/routers/admin.py`
  - `_normalize_program_row`가 adapter row의 region 필드를 payload에 포함하고, 없으면 location에서 보수적으로 추론한다.
- `docs/data/work24-training-sync.md`
  - Work24 scheduler env, admin sync query, region normalization 규칙을 문서화했다.

### 컴포넌트/함수별 변경

- `derive_korean_region`
  - 주소 alias와 Work24 지역 코드 prefix를 사용해 광역 region과 시·군·구 detail을 계산한다.
- `map_work24_training_item`
  - Work24 목록 응답 원본 주소/지역코드가 DB/API/UI 지역 매칭까지 이어지도록 normalized field를 만든다.
- `_normalize_program_row`
  - admin sync 저장 payload에서 region 값이 누락되지 않게 한다.

### 상태관리/데이터 흐름 변경

- 기존: source meta `서울` -> normalizer -> DB `region`.
- 변경: Work24 row `address`/`trngAreaCd` -> normalized `region`/`region_detail` -> DB payload -> API 지역 검색/추천 지역 매칭.

### 타입 개선

- 새 helper는 `tuple[str | None, str | None]`를 반환한다.
- `any` 추가는 없고, 기존 dict 기반 수집 row 흐름을 유지했다.

### 중복 제거 / 구조 개선

- Work24 collector와 admin adapter가 같은 지역 추론 helper를 공유한다.
- 운영 env 설명은 current-state 본문이 아니라 `docs/data/work24-training-sync.md`로 분리했다.

## 유지된 기존 동작

- scheduler의 기본 서울 수집 설정은 유지된다.
- Work24 `traEndDate`는 계속 `end_date`/`compare_meta.training_end_date`로만 저장되고 `deadline`으로 추정하지 않는다.
- 기존 `location`, provider, description, skills, source_unique_key mapping은 유지된다.

## 영향 범위

- 직접 영향: Work24 scheduler 수집, admin sync, programs row의 `region`/`region_detail`.
- 간접 영향: `/programs` 지역 검색, 비교/추천 지역 매칭.
- 회귀 가능성: 주소가 없고 중분류 코드만 있는 row는 `region_detail`이 광역 region과 같아질 수 있다.

## 테스트 체크리스트

- 정상 시나리오: 서울 주소가 `region=서울`, `region_detail=강남구`로 저장된다.
- 정상 시나리오: 부산 주소가 `region=부산`, `region_detail=해운대구`로 저장된다.
- edge case: 주소가 없고 `trngAreaCd=41135`만 있으면 `region=경기`로 fallback한다.
- 자동 테스트: `backend/tests/test_work24_kstartup_field_mapping.py`, `backend/tests/test_work24_training_adapter.py`, `backend/tests/test_admin_router.py`.

## 남은 과제

- 기존 운영 DB row의 `region_detail=서울` 같은 legacy 값을 이번 코드 변경만으로는 자동 교정하지 않는다.
- Work24 중분류 코드 전체를 시·군·구명으로 변환하는 상세 코드표는 아직 연결하지 않았다.

## 추가 리팩토링 후보

- Work24 공통 코드 API로 지역 중분류 코드표 동기화
  - 이유: 주소가 없을 때도 `region_detail`을 시·군·구명으로 채울 수 있다.
  - 우선순위: 중
- 기존 Work24 DB row region backfill
  - 이유: 신규 sync 전까지 과거 row는 legacy 지역값을 유지할 수 있다.
  - 우선순위: 중
- K-Startup/HTML source에도 같은 주소 정규화 helper 적용
  - 이유: source별 지역 품질을 더 일관되게 만들 수 있다.
  - 우선순위: 하

## 다음 대화에서 바로 이어갈 프롬프트

```text
현재까지의 변경 맥락은 위 문서를 기준으로 이어가고,
기존 동작 유지와 최소 변경 원칙을 지키면서
남은 과제 중 우선순위가 가장 높은 항목부터 진행해줘.
관련 파일을 먼저 파악하고,
필요 시 국소 리팩토링을 함께 제안해줘.
```
