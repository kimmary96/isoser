# Work24 Default Exposure Sync Result - 2026-04-23

## Summary

| 항목 | 결과 |
|---|---:|
| Work24 서울 API fetch | 5,636건 |
| 1차 upsert payload | 5,636건 |
| 1차 upsert 반환 | 5,636건 |
| 1차 estimated new rows | 2,434건 |
| 2차 idempotency upsert payload | 5,625건 |
| 2차 estimated new rows | 0건 |

## Changed Files

| 파일 | 변경 이유 |
|---|---|
| `backend/routers/admin.py` | 운영 Work24 sync payload를 100건 단위로 나눠 Supabase timeout/payload size 리스크를 줄임 |
| `backend/tests/test_admin_router.py` | Work24 session key 보존, same HRD 다른 회차 dedupe, batch upsert 회귀 테스트 |
| `backend/tests/test_programs_router.py` | active Work24 unknown-deadline 노출, 기본 70% Work24 mix, 창업/source filter 예외 회귀 테스트 |

## Preserved Behaviors

| 동작 | 유지 |
|---|---|
| Work24 `deadline=end_date`는 실제 모집 마감일로 보지 않음 | 유지 |
| 창업 category/detail/q/source 명시 필터 | Work24 70% mix 미적용 |
| 기존 Supabase missing-column fallback | batch 내부에서 유지 |
| 기존 unique conflict row-by-row fallback | batch 내부에서 유지 |

## DB Verification

| source | total | deadline_null | deadline_eq_end_date | source_unique_key_missing | skills_empty | description_empty | raw_data_present |
|---|---:|---:|---:|---:|---:|---:|---:|
| 고용24 | 12,156 | 12,099 | 0 | 0 | 7,917 | 55 | 11,908 |
| work24_training | 41 | 41 | 0 | 0 | 41 | 0 | 0 |
| K-Startup 창업진흥원 | 306 | 0 | 290 | 0 | 43 | 16 | 290 |

## API Exposure Check

| 조회 | 결과 |
|---|---|
| `/programs?recruiting_only=true&sort=deadline&limit=20` | 고용24 14건, K-Startup 6건, Work24 ratio 0.70 |
| `/programs?category=창업&recruiting_only=true&limit=20` | K-Startup 20건, Work24 ratio 0.00 |
| `/programs?q=스타트업&recruiting_only=true&limit=20` | K-Startup 9건, 고용24 3건 |

## Risks

| 리스크 | 상태 |
|---|---|
| Work24 실제 신청 마감일 부재 | 여전함. `deadline`은 보수적으로 null 유지 |
| 전국 sync | Work24 API 6개월 전체가 106,411건이라 단일 실행 보류 |
| skills 품질 | 새 row 일부는 키워드 추출이 비어 있음. raw_data는 대부분 확보 |
| Chroma/RAG 재색인 | 이번 직접 DB upsert에서는 별도 Chroma sync를 실행하지 않음 |

## Verification Commands

| 명령 | 결과 |
|---|---|
| `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py backend\tests\test_admin_router.py -q` | 78 passed |
| 운영 Work24 서울 sync 1차 | estimated_new_rows 2,434 |
| 운영 Work24 서울 sync 2차 | estimated_new_rows 0 |

## Follow-Up Refactoring Candidates

| 후보 | 우선순위 |
|---|---|
| Work24 sync를 지역/기간 shard 단위 운영 CLI로 분리하고 checkpoint를 남김 | 상 |
| Work24 신청 마감일 전용 source signal 확보 전까지 calendar 추천에는 unknown deadline row를 넣지 않음 | 상 |
| Chroma 재색인을 source/update window 단위로 별도 실행 | 중 |
