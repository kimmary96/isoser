# 프로그램 검색/deadline audit/추천 캐시 정합화 결과

## 변경 파일

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `scripts/program_backfill.py`
- `backend/tests/test_program_backfill.py`
- `supabase/migrations/20260423123000_align_recommendations_cache_schema.sql`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유

- 비교 모달 검색 UI는 카테고리 검색을 암시하지만, 백엔드 후처리 검색은 `category` / `category_detail`를 직접 보지 않아 카테고리만 일치하는 프로그램이 최종 결과에서 빠질 수 있었다.
- 운영 스키마상 `close_date`가 있어도 `/programs` 목록 query는 `deadline >= today`를 먼저 걸기 때문에 deadline 누락/오매핑 row를 별도로 식별할 audit 경로가 필요했다.
- 운영 `recommendations` 테이블은 현재 코드가 기대하는 캐시 컬럼(`similarity_score`, `relevance_score`, `urgency_score`, `final_score`, `generated_at`)과 어긋날 수 있어 캐시 저장/조회가 실패할 수 있었다.

## 변경 내용

- `/programs?q=` 후처리 검색 rank에 `category`, `category_detail`, 카테고리 alias를 추가했다.
- `scripts/program_backfill.py --deadline-audit` dry-run을 추가해 deadline 검색 후보 누락 위험 row를 분류한다.
- Windows 콘솔에서 audit 결과에 이모지/특수문자가 있어도 출력 실패하지 않도록 stdout UTF-8 설정을 추가했다.
- `recommendations` 캐시 스키마 정합화 migration을 추가하고, legacy `score`/`created_at` 캐시 읽기 fallback을 추가했다.

## 보존한 동작

- 기존 `search_text` 기반 DB 후보 축소와 short ASCII 검색 fallback은 유지했다.
- 추천 fresh path, stale cache recompute, anonymous/default 추천 fallback은 유지했다.
- deadline audit는 읽기 전용이며 운영 DB 값을 수정하지 않는다.

## 검증

- 통과: `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_program_backfill.py -q`
  - `70 passed`
- 통과: `git diff --check -- backend/routers/programs.py backend/tests/test_programs_router.py scripts/program_backfill.py backend/tests/test_program_backfill.py supabase/migrations/20260423123000_align_recommendations_cache_schema.sql`
- 실행: `backend\venv\Scripts\python.exe scripts/program_backfill.py --deadline-audit --limit 200 --format json`
  - `candidate_count`: 248
  - `suspect_count`: 245
  - `work24_deadline_copied_from_end_date`: 182
  - `active_row_without_recruiting_deadline`: 48
  - `deadline_equals_end_date_review`: 15

## 리스크 / possible regressions

- 카테고리 alias 검색이 추가되어 일부 검색어의 결과 폭이 기존보다 넓어질 수 있다.
- 추천 캐시 migration은 중복 `(user_id, program_id)` cache row를 최신 `generated_at` 기준으로 1개만 남긴다. recommendations는 캐시 성격이지만, 운영 적용 전 중복 여부를 한 번 확인하는 편이 안전하다.
- deadline audit는 원인 식별만 하며, 실제 `deadline` backfill이나 고용24 row 수정은 별도 작업으로 남아 있다.

## 추가 리팩토링 후보

- `/programs` DB query 단계도 `deadline OR close_date`를 고려하도록 확장해 `close_date`만 있는 row가 후보에서 빠지지 않게 한다.
- `PROGRAM_CATEGORY_SEARCH_ALIASES`를 프론트 카테고리 옵션과 공용 소스에서 생성해 라벨 중복을 줄인다.
- `recommendations` 캐시 스키마 상태를 health/audit endpoint에서 확인할 수 있게 한다.
