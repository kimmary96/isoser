# Work24 지역 partition sync 결과

## 변경 파일

| 파일 | 내용 |
|---|---|
| `scripts/work24_partition_sync.py` | `srchTraArea1` 기준 Work24 광역 지역 partition preview/apply runner 추가 |
| `backend/tests/test_work24_partition_sync.py` | 17개 지역 중복 없는 순서, 서울 제외 기본값, resume/stop 옵션 회귀 테스트 |
| `docs/data/work24-training-sync.md` | partition sync 순서와 실행 명령 문서화 |
| `docs/current-state.md` | 전국 조회 한도 회피 경로 반영 |
| `docs/refactoring-log.md` | 실행 결과 기록 |
| `reports/work24_partition_preview_20260423.json` | 경기부터 제주까지 preview JSON |
| `reports/work24_partition_sync_20260423.json` | 실제 apply 결과 JSON |

## 변경 이유

Work24 국민내일배움카드 목록 API 전국 단일 조회는 2026-04-23 기준 6개월 범위에서 108,069건이었다. API 문서상 `pageNum <= 1000`, `pageSize <= 100`이므로 단일 조회는 최대 100,000건까지만 안전하게 순회할 수 있다. 따라서 광역 지역 대분류(`srchTraArea1`)별로 쪼개 누락 없이 sync한다.

## Partition 순서

서울은 이미 sync/backfill 완료된 상태라 기본 실행에서 제외했다. 서울 인접 권역부터 다음 순서로 진행한다.

| 순서 | 코드 | 지역 |
|---:|---|---|
| 1 | 41 | 경기 |
| 2 | 28 | 인천 |
| 3 | 51 | 강원 |
| 4 | 43 | 충북 |
| 5 | 44 | 충남 |
| 6 | 36 | 세종 |
| 7 | 30 | 대전 |
| 8 | 45 | 전북 |
| 9 | 47 | 경북 |
| 10 | 27 | 대구 |
| 11 | 48 | 경남 |
| 12 | 31 | 울산 |
| 13 | 26 | 부산 |
| 14 | 46 | 전남 |
| 15 | 29 | 광주 |
| 16 | 50 | 제주 |

## 시간 산정

실제 실행 로그 기준이다. 첫 실행은 경기 upsert 중 Supabase timeout이 발생했지만, retry 보강 후 같은 경기부터 idempotent 재실행해 완료했다.

| 범위 | rows | 순수 sync 시간 | 1초 region pause 포함 추정 |
|---|---:|---:|---:|
| 경기 -> 대전 | 10,292 | 194.137초 | 200.137초, 약 3분 20초 |
| 경기 -> 제주 전체 | 16,205 | 287.309초 | 302.309초, 약 5분 2초 |

사용자 메시지의 "우선 대전까지만" 요청은 전체 실행 완료 직후 도착했다. 되돌리지 않고 전체 적용 상태를 유지했으며, 이후 실행을 위해 `--stop-after 대전` 옵션을 추가했다.

대전까지만 실행하는 명령:

```powershell
backend\venv\Scripts\python.exe scripts\work24_partition_sync.py --apply --stop-after 대전 --report-path reports\work24_partition_sync_to_daejeon_YYYYMMDD.json
```

## Preview 결과

| 지역 | total_count | estimated_pages | 한도 내 |
|---|---:|---:|---|
| 경기 | 6,213 | 63 | yes |
| 인천 | 2,336 | 24 | yes |
| 강원 | 280 | 3 | yes |
| 충북 | 284 | 3 | yes |
| 충남 | 543 | 6 | yes |
| 세종 | 24 | 1 | yes |
| 대전 | 610 | 7 | yes |
| 전북 | 0 | 0 | yes |
| 경북 | 496 | 5 | yes |
| 대구 | 1,138 | 12 | yes |
| 경남 | 972 | 10 | yes |
| 울산 | 405 | 5 | yes |
| 부산 | 1,777 | 18 | yes |
| 전남 | 335 | 4 | yes |
| 광주 | 694 | 7 | yes |
| 제주 | 96 | 1 | yes |

## Apply 결과

| 지역 | fetched_rows | payload_rows | upserted_rows |
|---|---:|---:|---:|
| 경기 | 6,213 | 6,213 | 6,213 |
| 인천 | 2,336 | 2,336 | 2,336 |
| 강원 | 280 | 280 | 280 |
| 충북 | 284 | 284 | 284 |
| 충남 | 545 | 545 | 545 |
| 세종 | 24 | 24 | 24 |
| 대전 | 610 | 610 | 610 |
| 전북 | 0 | 0 | 0 |
| 경북 | 496 | 496 | 496 |
| 대구 | 1,138 | 1,138 | 1,138 |
| 경남 | 972 | 972 | 972 |
| 울산 | 405 | 405 | 405 |
| 부산 | 1,777 | 1,777 | 1,777 |
| 전남 | 335 | 335 | 335 |
| 광주 | 694 | 694 | 694 |
| 제주 | 96 | 96 | 96 |

## 최종 DB 확인

| 항목 | 값 |
|---|---:|
| Work24 계열 total | 27,772 |
| `고용24` | 27,739 |
| `work24_training` | 33 |
| `deadline_null` | 0 |
| `deadline_source=traStartDate` | 27,715 |
| `raw_data_present` | 27,495 |

상위 지역 분포:

| region | rows |
|---|---:|
| 서울 | 8,116 |
| 경기 | 8,108 |
| 부산 | 3,147 |
| 인천 | 2,336 |
| 대구 | 1,168 |
| 경남 | 1,068 |
| 광주 | 697 |
| 대전 | 610 |

## API 확인

| 경로 | 결과 |
|---|---|
| `/programs?recruiting_only=true&sort=deadline&limit=20` | 고용24 14, K-Startup 6, Work24 ratio 0.70 |
| `/programs?regions=경기&recruiting_only=true&sort=deadline&limit=20` | 고용24 20 |
| `/programs?regions=인천&recruiting_only=true&sort=deadline&limit=20` | 고용24 20 |
| `/programs?q=스타트업&recruiting_only=true&sort=deadline&limit=20` | K-Startup 9, 고용24 3 |

## 검증

| 명령 | 결과 |
|---|---|
| `backend\venv\Scripts\python.exe -m pytest backend\tests\test_work24_partition_sync.py -q` | 4 passed |
| Chroma programs sync 후보 200건 직접 실행 | 200 synced, 0 skipped |

이전 Work24 deadline fallback 변경의 전체 검증은 같은 세션에서 다음을 통과했다.

| 명령 | 결과 |
|---|---|
| `backend\venv\Scripts\python.exe -m pytest backend\tests -q` | 293 passed, 1 skipped |
| `npx tsc -p tsconfig.codex-check.json --noEmit` | passed |
| `npm test` | 3 files passed, 9 tests passed |
| `npm run build` | passed |

## 리스크

| 리스크 | 관리 |
|---|---|
| 첫 실행에서 Supabase timeout 발생 | runner에 upsert retry와 중간 report 저장 추가 |
| Chroma 추천 인덱스는 partition runner에 자동 연결되지 않음 | 후속으로 programs 후보 200건을 직접 sync해 200 synced, 0 skipped를 확인함. 다만 현재 환경은 `CHROMA_MODE=ephemeral`이라 프로세스 종료 후 유지되는 persistent index 보강으로 보기는 어렵다 |
| Gemini embedding 분당 quota 초과 | 100건 이후 429가 발생했지만 기존 local fallback 방어가 작동해 batch skip 없이 완료됨 |
| 전북 preview는 0건이지만 DB에는 legacy row가 남아 있음 | live API 응답 기준 신규 rows는 없고, 기존 DB row는 보존됨 |

## 추가 리팩토링 후보

| 우선순위 | 후보 |
|---|---|
| 상 | persistent Chroma 운영 모드에서 partition runner의 `--sync-chroma-at-end` 옵션 추가 |
| 중 | 실행 결과를 DB audit table 또는 `reports/*.json` diff로 누적 관리 |
| 하 | 거리 기준 순서를 config JSON으로 분리 |
