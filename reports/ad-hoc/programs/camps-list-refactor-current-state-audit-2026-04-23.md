# Camps / Programs List Refactor Current-State Audit

작성일: 2026-04-23

## 목적

이 리포트는 원래의 "Staff Engineer / Performance Architect" 프롬프트가 이미 수행된 뒤, 현재 저장소 상태가 그 지시를 얼마나 잘 반영했는지 점검한 결과다.

새 구현을 요구하는 문서가 아니라, 현재 구현/문서/테스트/마이그레이션을 대조한 사후 감사 리포트다.

## 검토 범위

- 문서: `docs/camps-list-refactor.md`, `docs/current-state.md`, `docs/refactoring-log.md`
- 보고서: `reports/TASK-2026-04-23-camps-list-read-model-refactor-result.md`, `reports/TASK-2026-04-23-program-list-read-model-runtime-fix-result.md`, `reports\ad-hoc\programs\programs-pagination-result.md`, `reports\ad-hoc\programs\camps-list-read-model-refactor-blocked.md`
- 백엔드: `backend/routers/programs.py`, `backend/services/program_list_scoring.py`
- 프론트엔드: `frontend/app/(landing)/programs/page.tsx`, `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`, `frontend/lib/programs-page-layout.ts`
- DB: `supabase/migrations/20260423170000_add_program_list_read_model.sql`, `20260423191000_program_list_read_model_runtime_indexes.sql`, `20260423192000_optimize_program_list_refresh.sql`, `20260423195000_improve_program_list_browse_pool_quality.sql`, `20260423203000_conservative_program_participation_display.sql`
- 테스트: `backend/tests/test_programs_router.py`, `frontend/lib/programs-page-layout.test.ts`

## 종합 판정

원래 프롬프트의 핵심 방향은 상당 부분 반영됐다.

- 기본 browse 경로용 `program_list_index` read model이 생겼다.
- 기본 browse pool은 300개 상한을 갖는다.
- 목록 API는 read model 우선, legacy fallback 구조로 바뀌었다.
- 추천 점수 계산, deadline confidence, facet snapshot, summary select, URL query sync, 테스트, 문서가 추가됐다.

다만 "프로덕션 수준으로 완성"이라고 보기에는 중요한 빈틈이 남아 있다.

- 프론트 검색 URL이 `scope=all`을 붙이는데, 백엔드 read-model query가 존재하지 않는 `scope` 컬럼을 `program_list_index`에 필터로 붙인다. 그 결과 UI 검색 경로는 read model 대신 legacy fallback으로 돌아갈 가능성이 높다.
- 프론트 메인 목록은 cursor가 아니라 offset 기반 숫자 페이지네이션으로 복구됐다. 현재 browse pool 300에서는 실용적이지만, 원래 지시의 "offset/limit 대신 cursor"와는 다르다.
- promoted/ad slot은 컬럼과 일부 분리만 있고, 실제 상단 고정 slot API/UI 계층은 없다.
- facet snapshot은 기본 browse 진입 최적화에는 효과적이지만, 활성 필터 조합별 facet count까지 정확하게 제공하는 구조는 아니다.
- 성능 검증은 일부 live latency 기록이 있으나, 체계적인 전후 비교, `EXPLAIN`, 10,000건 fixture/benchmark는 부족하다.

## 규칙 적용 점검

### 잘 적용된 점

- 최초 대화형 프롬프트가 task packet 요건을 만족하지 않아 `reports\ad-hoc\programs\camps-list-read-model-refactor-blocked.md`로 blocked 처리했다.
- 이후 `tasks/done/TASK-2026-04-23-camps-list-read-model-refactor.md`에 필수 frontmatter(`id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`)가 있는 task packet이 만들어졌다.
- dirty worktree drift를 `reports/TASK-2026-04-23-camps-list-read-model-refactor-drift.md`로 멈추고, recovery report로 planned-file fingerprint를 재설정한 뒤 진행했다.
- 구현 후 `docs/current-state.md`, `docs/refactoring-log.md`, `reports/*result.md`가 갱신됐다.
- "기존 동작 유지" 원칙에 맞게 `/programs` plain array 응답과 legacy fallback이 유지됐다.

### 아쉬운 점

- 최초 blocked 이후 구현이 결국 같은 큰 프롬프트 범위를 상당히 넓게 한 번에 처리했다. 결과적으로 read model, API, 프론트, migration, score, facet, runtime fix, pagination fix가 연쇄적으로 이어져 점진적 변경 원칙에는 부분적으로만 맞다.
- 리팩터링 결과와 후속 보정 로그가 여러 파일에 흩어져 있어 현재 truth를 재구성하려면 `docs/current-state.md`, refactoring log, 여러 result report를 함께 읽어야 한다.
- 현재 워크트리는 다른 변경과 미추적 파일이 섞여 있다. 이번 감사에서는 되돌리지 않았지만, 완료 상태 판단에는 노이즈가 된다.

## 프롬프트 요구사항 대비 현 상태

| 요구사항 | 현재 상태 | 판정 |
| --- | --- | --- |
| 기본 browse와 전체 search 분리 | `_program_list_mode()`로 browse/search/archive 분기 | 부분 충족 |
| `/camps` 기본 진입이 전체 10,000건 직접 browse 금지 | `/programs/list` 기본은 `browse_rank <= 300` read model 사용 | 충족 |
| browse pool 기본 300 config | `PROGRAM_BROWSE_POOL_LIMIT`, env override 존재 | 충족 |
| browse 필터는 pool 내부에서 동작 | read-model browse params에 `browse_rank <= 300`, `is_open=true` 적용 | 대체로 충족 |
| q 또는 `scope=all`이면 전체 검색 | mode는 search로 바뀌지만 `scope=eq.all` 필터 버그가 있음 | 미흡 |
| 종료/마감 과정 분리 | archive mode와 closed toggle 존재 | 부분 충족 |
| 추천순 기본 정렬 | default order가 `recommended_score desc, id asc` | 충족 |
| deadline confidence 낮으면 urgency 제외 | Python/SQL 모두 high일 때만 urgency 반영 | 충족 |
| promoted와 organic 분리 | `is_ad`, `promoted_rank`는 있으나 실제 slot layer 부족 | 부분 충족 |
| summary-only list response | read-model select는 heavy field 제외 | 충족, 단 legacy/model에는 남음 |
| cursor pagination | backend cursor 구현 있음 | 부분 충족 |
| offset pagination 금지 | frontend main list는 offset 기반 숫자 페이지네이션 사용 | 미충족 |
| facet snapshot/cache | `program_list_facet_snapshots` 및 filter-options fast path | 부분 충족 |
| feature flag/fallback | `ENABLE_PROGRAM_LIST_READ_MODEL`, legacy fallback 존재 | 충족 |
| response/query observability | read-model list elapsed log 존재 | 부분 충족 |
| 10,000건 fixture/benchmark | 확인되지 않음 | 미충족 |

## 더 좋게 적용된 점

1. Work24 편중 완화가 추가됐다.
   - 원래 프롬프트에는 없던 source diversity 보정이 `20260423195000_improve_program_list_browse_pool_quality.sql`에 추가됐다.
   - Work24를 70% soft cap으로 제한하고 다른 source를 interleave하는 방식은 운영 데이터 편중에 대한 현실적인 보정이다.

2. deadline 오염 방어가 더 보수적으로 들어갔다.
   - Work24 `deadline=end_date` 오염을 backend deadline resolver에서 무시한다.
   - `deadline_source=traStartDate`는 high가 아니라 medium으로 취급하고 urgency 점수에는 반영하지 않는다.

3. 런타임 보정이 이어졌다.
   - 초기 read model 이후 `PROGRAM_LIST_SUMMARY_SELECT`에서 `compare_meta`, 존재하지 않는 rating/detail 컬럼을 제거했다.
   - filter-options가 기본 browse에서 facet snapshot을 사용하게 되어 페이지 진입 전 legacy scan 병목이 줄었다.

4. 목록 참여시간 표시가 보강됐다.
   - `20260423203000_conservative_program_participation_display.sql`은 Work24 시간/주야/주말 메타를 이용해 read model의 `participation_mode_label`, `participation_time_text`를 채운다.
   - duration 기반 추론을 배제한 점은 오분류 리스크를 줄이는 방향이다.

## 주요 문제와 리스크

### 1. `scope=all` 검색이 read model을 깨뜨릴 가능성이 높음

백엔드 `_build_read_model_params()`는 `scope`가 있고 mode가 search면 `params["scope"] = "eq.<scope>"`를 추가한다.

하지만 `program_list_index`에는 `scope` 컬럼이 없고, `scope` 컬럼은 `program_list_facet_snapshots`에만 있다.

실제 확인:

```text
mode: search
params: {..., "scope": "eq.all"}
```

영향:

- `/programs?q=...` 프론트는 `scope=all`을 붙인다.
- `/programs/list?q=...&scope=all`은 read model query 실패 후 legacy fallback으로 갈 가능성이 크다.
- 결과적으로 "검색어 입력 시 전체 데이터셋을 read model/search_text로 검색"한다는 목표가 실제 UI 경로에서는 깨질 수 있다.

개선:

- `program_list_index` query params에서 `scope` 필터를 제거한다.
- `scope=all`은 mode 결정에만 사용하고 DB 컬럼 필터로 전달하지 않는다.
- `test_read_model_query_scope_all_does_not_add_scope_column_filter`를 추가한다.

### 2. cursor 조건과 region 필터가 같은 `or` 파라미터를 덮어쓴다

`_apply_read_model_cursor()`는 cursor 조건을 `params["or"]`에 넣는다. 이후 region 필터도 `params["or"]`를 사용한다.

영향:

- cursor + region 조합에서는 cursor 조건이 region `or` 조건으로 덮인다.
- 직접 API caller 기준으로 cursor pagination 안정성이 필터 조합에서 깨질 수 있다.
- 현재 프론트는 offset을 쓰므로 사용자에게 즉시 보이지 않을 수 있지만, 원래 요구한 cursor 기반 API 품질에는 맞지 않는다.

개선:

- PostgREST `and=(or(...),or(...))` 형태로 조건을 조합하거나, cursor 조건을 RPC로 옮긴다.
- 최소한 cursor + region 조합 테스트를 추가한다.

### 3. 프론트 main list는 cursor가 아니라 offset으로 회귀했다

`reports\ad-hoc\programs\programs-pagination-result.md`에 따르면 UX 문제를 해결하기 위해 `/programs/list`에 offset을 추가하고, 프론트는 page-derived offset으로 숫자 페이지네이션을 사용한다.

영향:

- 원래 지시의 "offset/limit 대신 cursor"는 현재 UI에서는 충족하지 않는다.
- browse pool 300에서는 큰 성능 문제는 아니지만, pool 상한을 키우거나 search/all 모드에서 deep paging을 허용하면 병목이 재발할 수 있다.

개선:

- UX는 숫자 페이지처럼 보이게 유지하되 내부적으로 cursor map을 저장하는 방식 검토.
- 또는 "browse pool 300 한정 offset 허용"을 명시적인 product/architecture decision으로 문서화한다.

### 4. facet snapshot은 기본 browse fast path에는 좋지만 조건별 facet count는 약함

`GET /programs/filter-options`는 mode가 browse이면 category/region 등 활성 필터가 있어도 최신 browse snapshot을 바로 반환한다.

영향:

- 기본 진입은 빨라진다.
- 하지만 "현재 필터 조건 기준 옵션/카운트"가 필요한 UX에서는 숫자가 전체 browse pool 기준으로 보일 수 있다.

개선:

- 기본 무필터 진입은 snapshot을 쓰고, 활성 필터가 있으면 read model 기반 light aggregation 또는 조합 snapshot을 사용한다.
- 최소한 UI가 count를 표시하지 않는다면 "옵션 후보"와 "정확한 facet count"를 구분해 API 이름/문서를 정리한다.

### 5. promoted/ad slot은 구조만 있고 제품 동작은 아직 부족

`is_ad`, `promoted_rank`, promoted index는 있지만 `_program_promoted_slot_limit()`은 실제 list 조립에 사용되지 않는다.

영향:

- organic recommended score와 promoted score를 섞지 않는 원칙은 어느 정도 지켰다.
- 그러나 "상단 고정 슬롯 기본 15개", "promoted와 organic 중복 방지", "별도 layer"는 완성되지 않았다.

개선:

- `/programs/list` 응답을 `{ promoted_items, organic_items }` 또는 dedicated promoted endpoint로 분리한다.
- 같은 id가 organic에 들어가지 않게 DB/API 레벨 테스트를 추가한다.

### 6. recommended score의 Python/SQL 완전 일치가 약하다

Python `compute_recommended_score()`의 completeness key는 `tuition_type`, `study_time`을 사용한다. read model/SQL 쪽은 `cost_type`, `participation_time`을 사용한다.

영향:

- Python legacy path와 SQL read model path의 `data_completeness` 및 recommendation reason이 다를 수 있다.
- 테스트는 Python score 자체는 검증하지만 SQL과 동일한 입력 계약을 강제하지 않는다.

개선:

- Python completeness key를 read model 필드명과 맞춘다.
- SQL refresh와 Python score에 같은 fixture를 적용하는 contract test를 추가한다.

### 7. 성능 검증은 아직 운영 판단용으로 부족

기록된 수치:

- `/programs/list` browse 20개: 약 2.44초
- filter-options facet snapshot: 약 0.3초
- 기존 RPC는 corrective migration 적용 전 statement timeout 재현

부족한 점:

- 전후 동일 조건 비교가 부족하다.
- `EXPLAIN`/query plan 요약이 없다.
- 10,000건 fixture 또는 seed 기반 benchmark가 없다.
- count는 PostgREST exact count header가 아니라 row fetch 후 `len(rows)` 방식이다.

개선:

- `scripts/benchmark_program_list.py` 같은 read-only benchmark를 추가한다.
- 대표 요청 5종(default browse, filtered browse, q search, archive, count/facet)에 대해 p50/p95, rows scanned, source path를 기록한다.
- 운영 DB에는 `EXPLAIN (analyze, buffers)` 결과를 별도 SQL report로 남긴다.

## 현재 테스트 결과

이번 감사 중 실행한 검증:

```powershell
backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q
```

결과:

- `95 passed`
- warning 6건: Python 3.10 지원 종료 예정 및 일부 SWIG deprecation warning

```powershell
npx --prefix frontend vitest run frontend/lib/programs-page-layout.test.ts
```

결과:

- `1 passed`, `2 tests passed`

테스트는 통과하지만, 위에서 지적한 `scope=all` read-model params, cursor+region `or` 덮어쓰기, SQL/Python score 계약 차이는 현재 테스트가 잡지 못한다.

## 코드 변경 제안

### 제안 1. `scope=all` read-model query 버그 수정

- 변경 이유: UI 검색 경로가 read model 대신 legacy fallback으로 돌아갈 수 있다.
- 영향 범위: `backend/routers/programs.py`의 `_build_read_model_params()`와 관련 테스트.
- 리스크: 낮음. `scope`는 mode 결정용으로만 쓰면 되고 read model table에는 해당 컬럼이 없다.
- 테스트 포인트: `scope=all`, `q + scope=all`, `scope=archive` 조합의 params 검증.
- 추가 리팩터링 후보: scope/mode normalize 결과를 작은 dataclass로 분리.

### 제안 2. cursor 조건과 필터 조건 조합 방식 정리

- 변경 이유: cursor와 region filter가 모두 PostgREST `or` 파라미터를 사용해 조건이 덮일 수 있다.
- 영향 범위: read-model cursor pagination API.
- 리스크: 중간. PostgREST boolean expression 문자열은 회귀 가능성이 있어 테스트가 필요하다.
- 테스트 포인트: cursor only, region only, cursor+region, cursor+category, invalid cursor.
- 추가 리팩터링 후보: read model query builder를 별도 pure helper로 분리.

### 제안 3. offset 사용 정책을 명시하거나 cursor 기반 UX로 재전환

- 변경 이유: 원래 기술 목표와 현재 UX 구현이 다르다.
- 영향 범위: `/programs/list`, `frontend/app/(landing)/programs/page.tsx`, `frontend/lib/api/backend.ts`.
- 리스크: 사용자 UX와 직접 연결된다. 숫자 페이지네이션을 다시 제거하면 혼란이 생길 수 있다.
- 테스트 포인트: page query 공유 URL, 필터 변경 후 page reset/clamp, next/prev 안정성.
- 추가 리팩터링 후보: 서버가 `page_cursor_map` 또는 opaque page token을 반환하는 구조.

### 제안 4. promoted layer를 실제 API/UI 계약으로 분리

- 변경 이유: promoted config와 rank는 있으나 제품 동작이 없다.
- 영향 범위: read-model query, response schema, frontend list rendering.
- 리스크: 광고 정책이 확정되지 않으면 과구현 가능성이 있다.
- 테스트 포인트: promoted limit 15, organic 중복 제거, promoted score와 organic score 미혼합.
- 추가 리팩터링 후보: `ProgramListPageResponse`에 `promoted_items` 추가.

### 제안 5. benchmark와 query plan 리포트 추가

- 변경 이유: 성능 개선의 핵심 산출물이 아직 정량적으로 약하다.
- 영향 범위: `scripts/`, `reports/`, 선택적으로 CI smoke.
- 리스크: 낮음. read-only 스크립트로 시작 가능하다.
- 테스트 포인트: fixture 10,000건, Supabase live dry-run, local/staging DB 실행 시간.
- 추가 리팩터링 후보: benchmark 결과를 JSONL로 누적해 regression trend를 볼 수 있게 한다.

## 결론

현재 구현은 원래 프롬프트의 방향을 단순 계획 수준이 아니라 실제 코드/DB/API/프론트/테스트/문서까지 상당히 반영했다. 특히 default browse를 `program_list_index`와 300개 pool 중심으로 바꾼 점, deadline confidence를 보수적으로 다룬 점, facet snapshot으로 초기 filter-options 병목을 줄인 점은 좋은 적용이다.

하지만 아직 "프로덕션 수준에 가까운 완성"이라고 닫기에는 검색 경로의 `scope=all` read-model 실패 가능성, cursor 조건 조합 버그, offset 회귀, promoted layer 미완성, 정량 성능 검증 부족이 남아 있다.

우선순위는 다음 순서가 적절하다.

1. `scope=all` read-model query 버그 수정
2. cursor + filter 조건 조합 테스트/수정
3. offset 허용 정책 문서화 또는 cursor 기반 UX 재설계
4. promoted layer 별도 API/UI 계약 정리
5. 10,000건 fixture/benchmark와 EXPLAIN 리포트 추가

