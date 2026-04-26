# SESSION-2026-04-26-program-card-data-root-cause-result

## 작업 요약
- 목적: 카드 표면에서 `본인부담금`이 총 훈련비로 보이던 경로와 non-Work24 카드가 신청기간을 일정으로 쓰던 경로를 root cause 기준으로 수정했다.
- 범위: Work24 상세 비용 파싱, K-Startup 외부 일정 파싱, dual-write/backfill 경로, 프런트 비용 fallback, live row 2건 보정, read-model 재생성, landing snapshot 대상 row patch.

## root cause
1. Work24 비용
- 목록 API row의 `realMan` 값이 legacy `subsidy_amount`로 들어가고, 이후 `programs.support_amount`, `program_list_index.compare_meta/subsidy_amount`, `program_landing_chip_snapshots.items[*].subsidy_amount`까지 그대로 전파됐다.
- 실제 자부담은 Work24 상세 HTML에만 `자비부담액` 형태로 존재했고, 기존 저장 경로는 이 상세 값을 canonical field로 승격하지 않았다.

2. non-Work24 일정
- K-Startup 계열 row는 `pbanc_rcpt_bgng_dt/pbanc_rcpt_end_dt` 신청기간이 `start_date/end_date`로 저장됐고, 외부 신청/안내 페이지의 실제 행사 일정은 수집되지 않았다.
- 그래서 카드 helper가 볼 수 있는 `program_start_date/program_end_date/schedule_text` 자체가 비어 있었고, non-Work24 카드가 `일정 확인 필요` 또는 신청기간 기반 값으로 남았다.

## 변경 파일
- `backend/rag/collector/external_program_schedule_parser.py`
- `backend/rag/collector/work24_detail_parser.py`
- `backend/services/program_dual_write.py`
- `scripts/program_backfill.py`
- `backend/tests/test_program_dual_write.py`
- `backend/tests/test_program_backfill.py`
- `frontend/lib/program-display.ts`
- `frontend/lib/program-display.test.ts`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 바꿨는가
- Work24 `realMan`은 안정적인 자부담 필드가 아니므로 더 이상 카드 `본인부담금` 근거로 쓰면 안 된다.
- K-Startup 외부 페이지 일정은 신청기간과 분리 저장돼야 non-Work24 카드가 실제 행사/운영 일정을 보여줄 수 있다.
- 프런트 fallback이 총 훈련비를 다시 `본인부담금`으로 되살리면 백엔드 수정만으로는 문제를 끝낼 수 없어서 display helper도 함께 보수적으로 바꿨다.

## live 데이터 조치
- `programs` row 직접 보정
  - `15342a4a-e072-4792-9ce2-dbb687629daf`
    - `support_amount=93100`
    - `subsidy_amount=93100`
    - `compare_meta.self_payment=93100`
    - `compare_meta.training_fee_total=265980`
  - `9c622c83-ac1e-4b7c-97dc-096d59ff2f57`
    - `application_start_date=2026-04-13`
    - `application_end_date=2026-04-27`
    - `program_start_date=2026-04-29`
    - `program_end_date=2026-04-29`
    - `compare_meta.schedule_text='2026-04-29 ~ 2026-04-29 / 14:00 ~ 15:30'`
- `program_list_index` 재생성
  - 기본 refresh는 Supabase client 10초 timeout 때문에 browse RPC에서 실패했다.
  - `SUPABASE_TIMEOUT_SECONDS=120`로 `scripts/refresh_program_list_index.py --browse-only`를 재실행해 browse pool 300건을 다시 계산했다.
- `program_landing_chip_snapshots`
  - live에서는 `refresh_program_landing_chip_snapshots` RPC가 `missing_rpc`로 skip됐다.
  - 최신 `landing-c / 전체 / 2026-04-26` snapshot row에서 스케치업 카드 item만 수동 patch해 `compare_meta.self_payment=93100`, `subsidy_amount=93100`를 반영했다.

## 유지한 동작
- Work24 카드는 계속 훈련기간(`start_date/end_date`)을 카드 일정으로 사용한다.
- non-Work24 카드는 신청마감 D-day badge 로직은 그대로 유지한다.
- 랜딩 칩 snapshot 우선 경로와 browse refresh resilient fallback 구조는 유지했다.
- 기존 D-day badge 공용 UI는 변경하지 않았다.

## 검증
- backend
  - `backend\venv\Scripts\python.exe -m pytest backend/tests/test_program_dual_write.py backend/tests/test_program_backfill.py backend/tests/test_work24_kstartup_field_mapping.py backend/tests/test_admin_router.py backend/tests/test_scheduler_collectors.py`
- frontend
  - `npm test -- lib/program-display.test.ts lib/server/program-card-summary.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`
  - `npx tsc --noEmit --pretty false`
- live 확인
  - `programs`와 `program_list_index`에서 스케치업 row의 `self_payment/support_amount=93100` 확인
  - `program_list_index`에서 도봉구청년창업센터 row의 `program_start_date/program_end_date=2026-04-29` 확인
  - `program_landing_chip_snapshots` 최신 `전체` row에서 스케치업 item의 `subsidy_amount=93100`, `compare_meta.self_payment=93100` 확인

## 리스크 / 가능한 회귀
- live `program_landing_chip_snapshots` refresh RPC가 아직 없어 snapshot row는 자동 재생성이 아니라 부분 수동 patch에 의존한다.
- Work24 오픈 풀 대부분은 여전히 detail-confirmed 자부담이 없어서, 지금 정책상 금액 대신 `자부담 정보 확인 필요`가 노출될 수 있다.
- K-Startup 외부 일정 파서는 label 기반 HTML 파싱이라, 사이트 구조가 크게 바뀌면 일정 추출 정확도가 다시 떨어질 수 있다.

## 추가 리팩토링 후보
- `program_list_index` surface contract에 verified `support_amount` 또는 `cost_self_pay` 컬럼을 명시적으로 추가해 snapshot/item patch 없이도 비용 의미를 더 분명히 전달하기.
- Work24 detail enrichment를 bounded batch worker로 분리해 현재 오픈 browse pool 300건 정도는 자동으로 상세 보강하도록 만들기.
- `program_landing_chip_snapshots` live RPC drift를 corrective migration으로 맞춰 snapshot 수동 patch 단계를 제거하기.
