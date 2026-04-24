# Work24 Chroma sync-at-end 결과

## 변경 파일

| 파일 | 내용 |
|---|---|
| `scripts/work24_partition_sync.py` | `--sync-chroma-at-end` 옵션, persistent mode guard, `source_unique_key` 기반 DB row 재조회 후 Chroma sync 연결 |
| `backend/tests/test_work24_partition_sync.py` | Chroma sync row dedupe, preview skip, non-persistent skip, persistent 실행, DB row 재조회 테스트 |
| `docs/data/work24-training-sync.md` | persistent Chroma 운영 실행 명령 문서화 |

## 변경 이유

Work24 지역 partition sync는 DB 최신화까지는 자동화했지만, 추천 경로가 참조하는 Chroma programs collection은 별도 수동 sync가 필요했다. 운영 자동화 관점에서는 DB upsert와 추천 인덱스 갱신 결과가 같은 report에 남아야 한다.

## 실제 동작

| 조건 | 동작 |
|---|---|
| `--sync-chroma-at-end` 없음 | 기존과 동일하게 DB upsert만 실행 |
| preview 실행 + `--sync-chroma-at-end` | Chroma sync를 실행하지 않고 `reason=requires_apply` 기록 |
| `CHROMA_MODE!=persistent` | Chroma sync를 실행하지 않고 `reason=non_persistent_chroma_mode` 기록 |
| `CHROMA_MODE=persistent` + `--apply --sync-chroma-at-end` | 각 partition에서 처리한 payload의 `source_unique_key`로 DB row를 다시 조회해 UUID `id`를 확보하고, program id 기준으로 dedupe한 뒤 Chroma programs collection에 batch sync |

## 유지된 기존 동작

| 영역 | 유지 내용 |
|---|---|
| 기본 partition sync | `--sync-chroma-at-end`를 명시하지 않으면 기존 preview/apply 결과와 report 구조 유지 |
| 서울 제외 기본값 | `--include-seoul` 없이는 기존처럼 서울을 제외하고 경기부터 진행 |
| retry/report 저장 | partition별 upsert retry와 중간 report 저장 유지 |
| ephemeral local mode | 임시 Chroma에는 자동 sync하지 않아 프로세스 종료 후 사라질 인덱스를 운영 반영으로 오인하지 않음 |
| 기존 미커밋 변경 | `docs/current-state.md`, `docs/refactoring-log.md` 등 별도 작업 변경은 이번 커밋 범위에서 제외 |

## 검증

| 명령 | 결과 |
|---|---|
| `backend\venv\Scripts\python.exe -m pytest backend\tests\test_work24_partition_sync.py -q` | 10 passed |
| `backend\venv\Scripts\python.exe -m py_compile scripts\work24_partition_sync.py` | passed |
| `CHROMA_MODE=persistent`, `--apply --sync-chroma-at-end --stop-after 경기 --max-pages 1` | `candidate_count=100`, `synced_count=100`, `skipped_count=0` |

Smoke report:

| 파일 | 내용 |
|---|---|
| `reports\ops\work24\work24_partition_sync_with_chroma_smoke_20260423.json` | persistent Chroma sync smoke 결과 |

## 리스크 / 회귀 가능성

| 리스크 | 관리 |
|---|---|
| persistent Chroma 대량 sync 시간이 길어질 수 있음 | runner report의 `chroma_sync.duration_seconds`, `synced_count`, `skipped_count`로 추적 |
| Gemini embedding quota 429 | 기존 Chroma client의 retry 후 local fallback 방어가 적용됨 |
| 운영 env가 여전히 `CHROMA_MODE=ephemeral` | sync는 skip되고 report에 이유가 남음. 운영 인덱스 반영을 원하면 `CHROMA_MODE=persistent`와 안정적인 `CHROMA_PERSIST_DIR` 필요 |

## 추가 리팩토링 후보

| 우선순위 | 후보 |
|---|---|
| 중 | Chroma sync batch size와 max rows를 CLI 옵션으로 분리 |
| 중 | partition별 Chroma sync가 아니라 전체 완료 후 실패 row만 재시도하는 별도 retry report 추가 |
| 하 | Chroma sync 결과를 DB audit table에 누적 저장 |

