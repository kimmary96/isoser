# Work24 훈련시작일 모집기한 fallback 적용 결과

## 변경 파일

| 파일 | 내용 |
|---|---|
| `backend/rag/collector/program_field_mapping.py` | Work24 `traStartDate`를 `raw_deadline`, `compare_meta.application_deadline`, `deadline_source=traStartDate`로 매핑 |
| `backend/rag/source_adapters/work24_training.py` | admin sync adapter row의 `deadline`을 훈련시작일로 설정하고 날짜를 `YYYY-MM-DD`로 정규화 |
| `backend/rag/collector/hrd_collector.py` | legacy HRD collector도 `traStartDate`를 deadline 원천으로 사용 |
| `backend/routers/admin.py` | `deadline=end_date` 방어 유지, `deadline_source=traStartDate`는 신뢰 |
| `backend/routers/programs.py`, `backend/rag/programs_rag.py` | 목록/추천 resolved deadline에서 Work24 훈련시작일 fallback을 신뢰 |
| `scripts/program_backfill.py` | backfill/audit가 `deadline_source=traStartDate` row를 오염값으로 분류하지 않도록 보정 |
| `frontend/app/api/dashboard/recommend-calendar/route.ts` | Supabase direct fallback도 Work24 훈련시작일 deadline source를 신뢰 |
| `frontend/lib/types/index.ts` | `CompareMeta` deadline source marker 타입 추가 |
| `docs/current-state.md`, `docs/data/work24-training-sync.md`, `docs/refactoring-log.md` | 현재 정책과 운영 결과 반영 |

## 변경 이유

Work24 국민내일배움카드 목록 API는 실제 신청 마감일 필드를 제공하지 않는다. 대신 요청/응답 기준이 훈련시작일(`srchTraStDt`, `srchTraEndDt`, `traStartDate`)이므로, `traStartDate`를 모집기한 fallback으로 사용해 모집중/마감순 목록에서 Work24 과정이 누락되지 않도록 했다.

## 보존한 동작

| 동작 | 상태 |
|---|---|
| `traEndDate`는 훈련 종료일로만 보존 | 유지 |
| 기존 Work24 `deadline=end_date` 오염값 무시 | 유지 |
| `deadline_source=traStartDate`가 있는 1일 과정 신뢰 | 추가 |
| 창업 검색/필터에서 K-Startup 우선 노출 | 유지 |
| 기본 프로그램 목록 Work24 70% mix | 유지 |

## 운영 DB 적용

| 단계 | 결과 |
|---|---:|
| Work24 서울 live sync/upsert | 5,646 rows |
| `raw_data.traStartDate` 기반 dry-run 후보 | 6,272 rows |
| raw 기반 deadline 보강 | 적용 완료 |
| `start_date`만 있는 잔여 Work24 계열 보강 | 231 rows |
| 최종 Work24 계열 `deadline_null` | 0 rows |

최종 DB 집계:

| source | total | deadline_source=traStartDate | deadline_eq_start_date | raw_data_present |
|---|---:|---:|---:|---:|
| 고용24 | 12,165 | 12,108 | 12,107 | 11,918 |
| work24_training | 41 | 41 | 41 | 0 |

API 확인:

| 경로 | 결과 |
|---|---|
| `/programs?recruiting_only=true&sort=deadline&limit=20` | 고용24 14, K-Startup 6, Work24 ratio 0.70 |
| `/programs?q=스타트업&recruiting_only=true&sort=deadline&limit=20` | K-Startup 9, 고용24 3 |
| `/programs?category=창업&recruiting_only=true&sort=deadline&limit=20` | K-Startup 16, 고용24 4 |

## 실행 가능한 SQL

DB에서 같은 정책을 SQL로 점검/재적용할 때 사용할 수 있는 안전 쿼리다.

```sql
select
  source,
  count(*) as total,
  count(*) filter (where deadline is null) as deadline_null,
  count(*) filter (where compare_meta->>'deadline_source' = 'traStartDate') as deadline_from_training_start
from public.programs
where source ilike '%고용24%' or source ilike '%work24%'
group by source
order by source;
```

```sql
update public.programs
set
  deadline = start_date,
  compare_meta = coalesce(compare_meta, '{}'::jsonb)
    || jsonb_build_object(
      'application_deadline', start_date::text,
      'deadline_source', 'traStartDate',
      'training_start_date', start_date::text,
      'training_end_date', end_date::text
    )
where (source ilike '%고용24%' or source ilike '%work24%')
  and deadline is null
  and start_date is not null;
```

## 검증

| 명령 | 결과 |
|---|---|
| `backend\venv\Scripts\python.exe -m pytest backend\tests -q` | 293 passed, 1 skipped |
| `npx tsc -p tsconfig.codex-check.json --noEmit` | passed |
| `npm test` | 3 files passed, 9 tests passed |
| `npm run build` | passed |

## 리스크

| 리스크 | 관리 |
|---|---|
| `traStartDate`는 실제 신청 마감일이 아니라 fallback | `compare_meta.deadline_source=traStartDate`로 출처 표시 |
| 실제 조기 마감 과정은 시작일 전 마감될 수 있음 | 상세 HTML에서 실제 신청 마감일을 찾으면 기존 backfill이 더 정확한 deadline으로 교체 가능 |
| 전국 단일 Work24 조회는 108,069건으로 API 100,000건 페이지 한도 초과 | 전국 무누락은 지역별 `srchTraArea1` 분할 수집 작업 필요 |

## 추가 리팩토링 후보

| 우선순위 | 후보 |
|---|---|
| 상 | Work24 전국 sync를 17개 광역 지역 partition job으로 분리 |
| 중 | Supabase row별 backfill을 reusable async batch patch helper로 추출 |
| 하 | Work24 deadline source marker helper를 backend 공통 모듈로 통합 |
