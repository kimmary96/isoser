# SESSION-2026-04-26 Work24 Canonical Self-Pay Repair Result

## 변경 파일
- `scripts/backfill_work24_browse_pool_self_pay.py`
- `backend/tests/test_work24_browse_pool_self_pay_backfill_script.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유
- Work24 상세 HTML에서 확인된 자부담금이 `compare_meta.self_payment/out_of_pocket`에는 있었지만, 기존 canonical `support_amount/subsidy_amount`가 총 훈련비와 같은 값으로 남아 목록/상세에서 자부담금이 과대 표기될 수 있었다.
- 대표 사례 `09b33464-3ac7-4eeb-a4bd-1ff03ea48eb4`는 Work24 원문 기준 `훈련비 629,760원`, 일반훈련생 기준 자부담금 `220,420원`인데 live DB canonical 값이 `629,760원`으로 오염되어 있었다.

## 변경 내용
- backfill 스크립트가 Work24 row의 기존 `compare_meta.self_payment/out_of_pocket` 증거를 읽어 canonical `support_amount/subsidy_amount`를 복구하도록 보강했다.
- detail fetch가 필요한 row와 이미 detail 증거가 있는 row를 구분해, 불필요한 Work24 재요청 없이 stale canonical 금액을 patch한다.
- 테스트에 `support_amount/subsidy_amount == cost`인 stale row를 `self_payment` 기준으로 복구하는 회귀 케이스를 추가했다.

## 운영 적용
- `pool_limit=300`, `overwrite=False` 기준 dry-run 결과: Work24 후보 299건, patch 277건.
- apply 결과: 277건 적용.
- 대표 row 결과:
  - `programs.cost`: `629760`
  - `programs.support_amount`: `220420`
  - `programs.subsidy_amount`: `220420`
  - `program_list_index.verified_self_pay_amount`: `220420`
- 적용 후 Work24 browse pool 299건 중 canonical 자부담이 있는 278건을 비교했고, `programs.support_amount`와 `program_list_index.verified_self_pay_amount` mismatch는 0건이었다.

## 보존한 동작
- Work24 상세 증거가 없는 row는 총 훈련비를 자부담금으로 강제 변환하지 않는다.
- `overwrite=False`에서는 이미 canonical 자부담이 총 훈련비보다 작고 일관된 row를 건드리지 않는다.
- 기존 `/programs/list` 응답 shape는 유지하고, read-model의 `verified_self_pay_amount` bridge 동작을 그대로 사용한다.

## 검증
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_work24_browse_pool_self_pay_backfill_script.py -q`
- `backend\venv\Scripts\python.exe -m py_compile scripts\backfill_work24_browse_pool_self_pay.py`
- API smoke:
  - `GET http://127.0.0.1:8000/programs/list?limit=5&recruiting_only=true`
  - `GET http://127.0.0.1:8000/programs/09b33464-3ac7-4eeb-a4bd-1ff03ea48eb4/detail`

## 리스크 / 후속 과제
- bulk browse refresh RPC는 적용 직후 한 번 `ReadTimeout`이 발생했다. 다만 live trigger/read-model 확인에서는 대상 값이 반영되어 있었고 mismatch 0건으로 확인됐다.
- dry-run 기준 아직 patch 없이 남는 suspicious row 3건은 상세 증거가 불충분하거나 현재 parser가 canonical patch를 만들지 못한 케이스로 보인다. 별도 샘플링으로 Work24 HTML 구조 차이를 확인할 수 있다.
- read-model refresh RPC timeout을 줄이기 위해 browse refresh 후보 범위와 snapshot refresh를 더 작게 나누는 운영 리팩토링이 남아 있다.
