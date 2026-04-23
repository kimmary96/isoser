# Work24 Region Code Backfill Result - 2026-04-23

## Summary

- Work24 공통 코드 API `dtlGb=1` 지역 코드표를 `regionCd`/`regionNm` 기준으로 파싱하도록 보강했다.
- scheduler/admin sync는 `WORK24_COMMON_CODES_AUTH_KEY`가 있으면 중분류 코드 map을 사용해 `trngAreaCd`를 시군구명 `region_detail`로 저장한다.
- 운영 Supabase의 Work24 row는 적용 전 백업 후 가능한 지역 보정을 직접 적용했다.

## Changed Files

| file | reason |
|---|---|
| `backend/rag/collector/program_field_mapping.py` | `derive_korean_region`이 공통 코드 map을 받도록 확장하고, `성남시 분당구`처럼 복합 시군구명을 보존 |
| `backend/rag/source_adapters/work24_supplementary.py` | 공통 코드 `regionCd`/`regionNm` flatten 및 `fetch_region_code_map` 추가 |
| `backend/rag/source_adapters/work24_training.py` | training adapter 정규화에 `region_code_map` 주입 |
| `backend/rag/collector/work24_collector.py` | scheduler collector가 공통 코드 map을 로드해 field mapping에 전달 |
| `backend/routers/admin.py` | admin sync가 공통 코드 map을 사용할 수 있도록 연결 |
| `docs/data/work24-training-sync.md` | region normalization과 `WORK24_COMMON_CODES_AUTH_KEY` 문서화 |

## DB Apply

| item | result |
|---|---|
| Work24 rows fetched | 3,438 |
| common region code map | 284 codes |
| initial patch backup | `.tmp_db_backup/work24-region-backfill-20260423T055013Z.json` |
| remaining patch backup | `.tmp_db_backup/work24-region-backfill-remaining-20260423T060222Z.json` |
| final remaining patch count | 0 |
| failed patch count | 0 |

Final DB summary:

| source | total | blank/nation region | blank detail | legacy detail | specific detail |
|---|---:|---:|---:|---:|---:|
| 고용24 | 3,391 | 0 | 0 | 55 | 3,336 |
| work24_training | 47 | 0 | 0 | 0 | 47 |

The remaining 55 `region_detail=서울` rows have no `location`, `compare_meta.trng_area_code`, or raw `trngAreaCd`, so they were not changed automatically.

Readable audit SQL:

```sql
select
  id,
  title,
  source,
  region,
  region_detail,
  location,
  compare_meta ->> 'trng_area_code' as compare_trng_area_code,
  raw_data ->> 'trngAreaCd' as raw_trng_area_code
from public.programs
where source in ('고용24', 'work24_training')
  and region_detail in ('서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                        '경기', '충북', '충남', '전북', '전남', '경북', '경남', '제주', '강원')
order by source, title;
```

## Verification

- `backend/venv/Scripts/python.exe -m pytest backend/tests/test_work24_training_adapter.py backend/tests/test_work24_supplementary_adapter.py backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_scheduler_collectors.py -q`
  - Result: 38 passed.
- `backend/venv/Scripts/python.exe -m pytest backend/tests -q`
  - Result: 283 passed, 1 skipped.
- DB post-apply verification confirmed no remaining code/address-derived Work24 region patch candidates.

## Risks / Follow-Up

- The remaining 55 legacy Seoul-detail rows need fresh Work24 sync or detail re-fetch to recover missing source area code/address.
- If `WORK24_COMMON_CODES_AUTH_KEY` is absent or common code API fails, collection falls back to address parsing and broad region-code prefix behavior.
- This change does not recover real Work24 application deadlines; deadline repair remains dependent on source detail signals.
