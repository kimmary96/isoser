# Programs Filter Tags Ad-hoc Result

## blocked 문서 재점검

| 문서 | 판정 | 근거 |
| --- | --- | --- |
| `reports/program-detail-page-ad-hoc-blocked.md` | 적용 완료 | `TASK-2026-04-22-1618-program-detail-page` result/verifier가 상세 페이지 구현과 pass 판정을 기록함 |
| `reports/programs-filter-tags-ad-hoc-blocked.md` | 미적용 후 적용 | 로컬 backend에서 `category_detail=data-ai&category=AI`가 빈 결과를 반환했고, `category=AI`는 결과를 반환해 세부 카테고리 exact 필터 문제가 남아 있었음 |

## 우선순위

1. `/programs` 세부 카테고리 필터 빈 결과 보정
2. 전체 목록의 온/오프라인 표시 보정
3. 장기 데이터 backfill로 후처리 의존 축소

## changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/programs-filter-tags-ad-hoc-result.md`

## why changes were made

- 운영 DB의 많은 프로그램 row는 `category_detail`이 비어 있지만, 제목/category/skills 기준으로는 `AI`, `웹개발` 같은 세부 카테고리에 속한다.
- 기존 API는 `category_detail=eq.<id>`를 Supabase exact 필터로 먼저 걸어, UI에서 직무 카테고리를 선택하면 실제 후보가 0건이 될 수 있었다.
- 고용24 원격훈련 row는 `target`/`raw_data.trainTarget`에 `근로자원격훈련`이 있어도 `teaching_method`가 비어 전체 목록에서 온/오프라인 표시가 빠질 수 있었다.

## preserved behaviors

- 기존 `category`, 검색어, 모집중, 마감일, 비용, 참여 시간, 운영 기관, 추천 대상 필터 계약은 유지했다.
- 명시 저장된 `teaching_method` 값이 있으면 그 값을 우선 사용한다.
- 상세 페이지 구현은 이미 적용 완료된 항목으로 분류하고 재구현하지 않았다.

## risks / possible regressions

- 세부 카테고리 alias 매칭은 문자열 기반이라 일부 프로그램이 넓게 포함되거나 빠질 수 있다.
- `category_detail` exact DB 필터를 후처리로 바꾸면서 카테고리 선택 API는 후보 scan을 더 많이 사용할 수 있다.
- 원격훈련 표시 보정은 원천 target 문구에 의존하므로, source별 raw 필드가 더 다양해지면 규칙 보강이 필요하다.

## follow-up refactoring candidates

- collector/normalizer 단계에서 `category_detail`과 `teaching_method`를 안정적으로 채우는 backfill을 별도 실행한다.
- 카테고리 alias 규칙을 `backend/routers/programs.py`에서 별도 classifier module로 분리한다.
- `PROGRAM_CATEGORY_DETAIL_*` 규칙을 frontend 카테고리 옵션과 공유 가능한 계약 문서로 정리한다.

## verification

- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py`: 통과
- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`: 통과 (`78 passed`, warnings only)
- `GET http://localhost:8000/programs/?category_detail=data-ai&category=AI&recruiting_only=true&limit=3`: 3건 반환
- `GET http://localhost:8000/programs/count?category_detail=data-ai&category=AI&recruiting_only=true`: `{"count":1373}`
- 위 목록 응답 첫 row에서 `target=["근로자원격훈련"]` 기반 `teaching_method="온라인"` 보정 확인
