# Work24 Training API Params Result

작성일: 2026-04-23

## Summary

| 항목 | 상태 | 즉시 수정 우선순위 |
|---|---|---|
| 목록 endpoint `callOpenApiSvcInfo310L01.do` | 확정 | 상 |
| 문서 필수 파라미터 반영 | 완료 | 상 |
| 문서 선택 파라미터 지원 | 완료 | 중 |
| legacy `srchNcsCd` 제거 | 완료. 기존 `ncs_code` 입력은 `srchNcs1~4`로 변환 | 상 |
| 기존 서울 scheduler 동작 | 유지. `WORK24_TRAINING_AREA1=ALL`이면 area1 파라미터 생략 | 중 |

## Changed Files

| 파일 | 변경 이유 | 영향 범위 |
|---|---|---|
| `backend/rag/source_adapters/work24_training.py` | Work24 목록 API 파라미터 builder 공통화 | admin sync, adapter tests |
| `backend/rag/collector/work24_collector.py` | scheduler 수집 요청도 문서 필수 파라미터를 보내도록 보강 | scheduled full sync |
| `backend/routers/admin.py` | admin sync에서 문서 선택 파라미터를 query로 전달 | `POST /admin/sync/programs` |
| `backend/tests/test_work24_training_adapter.py` | 필수/선택 파라미터와 legacy NCS 변환 고정 | backend tests |
| `backend/tests/test_scheduler_collectors.py` | scheduler params/env override 고정 | backend tests |
| `backend/tests/test_admin_router.py` | admin sync query 전달 고정 | backend tests |

## Parameter Coverage

| API param | scheduler | admin sync | 비고 |
|---|---|---|---|
| `authKey` | 지원 | 지원 | `WORK24_TRAINING_AUTH_KEY` |
| `returnType` | `JSON` | `JSON` | 고정 |
| `outType` | `1` | `1` | 목록 |
| `pageNum` | 지원 | 지원 | pagination |
| `pageSize` | `100` | `100` | API 최대값 |
| `srchTraStDt` | 기본 오늘 또는 `WORK24_TRAINING_START_DT` | `start_dt` 또는 오늘 | 필수 |
| `srchTraEndDt` | 기본 6개월 후 또는 `WORK24_TRAINING_END_DT` | `end_dt` 또는 6개월 후 | 필수 |
| `sort` | 기본 `ASC`, env override | query `sort` | 필수 |
| `sortCol` | 기본 `2`, env override | query `sortCol` | 필수 |
| `wkendSe` | env override | query `wkendSe` | 선택 |
| `srchTraArea1` | 기본 `11`, `ALL`이면 생략 | `srchTraArea1` 또는 legacy `area_code` | 선택 |
| `srchTraArea2` | env override | query `srchTraArea2` | 선택 |
| `srchNcs1~4` | env override | query `srchNcs1~4` | 선택 |
| `crseTracseSe` | env override | query `crseTracseSe` | 선택 |
| `srchTraGbn` | env override | query `srchTraGbn` | 선택 |
| `srchTraType` | env override | query `srchTraType` | 선택 |
| `srchTraProcessNm` | env override | query `srchTraProcessNm` | 선택 |
| `srchTraOrganNm` | env override | query `srchTraOrganNm` | 선택 |

## Preserved Behaviors

| 동작 | 보존 방식 |
|---|---|
| scheduler 서울 기본 수집 | `WORK24_TRAINING_AREA1` 기본값 `11` 유지 |
| admin sync 기존 `area_code` | `srchTraArea1`이 없으면 `area_code` 사용 |
| admin sync 기존 `ncs_code` | 명시 `srchNcs1~4`가 없을 때 코드 길이 기준으로 문서 파라미터에 매핑 |
| full pagination | 기존 `scn_cnt / pageSize` 계산 유지 |

## Risks

| 리스크 | 대응 |
|---|---|
| `sortCol=2`는 훈련시작일 기준이라 신규/마감 우선순위와 다를 수 있음 | API 문서 필수 기본값으로 유지. 필요 시 env/query로 `1`, `3`, `5` 선택 |
| scheduler 전국 수집으로 바꾸면 `region` meta가 기존 서울 기준과 달라질 수 있음 | 기본은 서울 유지. 전국 수집은 `WORK24_TRAINING_AREA1=ALL`로 명시 실행 |
| `ncs_code` legacy 값의 단계 추정은 코드 길이에 따른 보수적 변환임 | 정확한 단계가 필요하면 `srchNcs1~4`를 직접 지정 |

## Verification

| 검증 | 결과 |
|---|---|
| targeted tests | `32 passed` |

## Follow-Up Refactoring Candidates

| 후보 | 이유 |
|---|---|
| Work24 지역 코드 기반 `region`/`region_detail` 정규화 | 전국 수집 시 source meta가 아닌 row 주소/지역코드 기준으로 필터 품질을 높일 수 있음 |
| scheduler env 이름 문서화 | 운영자가 `WORK24_TRAINING_*` 필터를 안전하게 조합할 수 있게 함 |
