# AWS Boottent Pipeline Borrowing Performance Report

작성일: 2026-04-23

대상 범위:

- 적용 완료: 1. 품질 validator / dry-run summary, 2. 품질 리포트 CLI, 3. 골든 fixture, 3-확장. 원문 필드 근거 보존
- 미적용: 4. 동적 페이지 Retrieve, 5. 이미지/OCR

참고 사례:

- AWS 기술 블로그: [부트텐트의 생성형 AI 기반 교육과정 등록 자동화 시스템 구성하기](https://aws.amazon.com/ko/blogs/tech/boottent-genai-course-registration-automation/)

## Executive Summary

부트텐트는 Amazon Bedrock과 AWS Step Functions 기반 자동화 파이프라인으로 교육과정 등록 시간을 평균 약 69.0% 줄이고, 골든 데이터셋 기준 필드 정확도 88.7%를 기록했다. 또한 하이브리드 Vision OCR 구성으로 Claude 4.5 Haiku 단독 대비 OCR 비용을 약 40% 낮춘 사례를 제시했다.

우리 프로젝트는 Bedrock, Step Functions, Playwright, OCR을 도입하지 않고 먼저 데이터 품질 관측성과 회귀 방지 장치를 차용했다. 이번 1~3번 적용의 성과는 즉시 처리 속도나 OCR 비용 절감이 아니라, 수집 데이터가 서비스 DB에 들어가기 전후로 품질 문제를 구조화해서 확인하고, 원문 근거를 추적하며, 이후 동적 Retrieve/OCR 도입 여부를 판단할 수 있는 측정 기반을 만든 것이다.

현재 단계에서 정량적으로 주장 가능한 성과는 다음과 같다.

| 항목 | 적용 전 | 1~3번 적용 후 | 현재 상태 |
| --- | --- | --- | --- |
| 필드 품질 판정 | 수집 결과를 사람이 로그/DB로 확인 | `validate_program_row()`, `summarize_program_quality()`로 issue/severity 구조화 | 완료 |
| dry-run 품질 요약 | dry-run이 수집/정규화 중심 | source별 `quality` summary 추가 | 완료 |
| 운영 데이터 품질 리포트 | DB row 품질을 별도 스크립트로 재사용하기 어려움 | `scripts/program_quality_report.py`로 읽기 전용 JSON 리포트 생성 | 완료 |
| 회귀 기준 | 대표 케이스 기대 결과 없음 | Work24/K-Startup/SeSAC 골든 fixture 4건 추가 | 완료 |
| 원문 근거 추적 | 정규화 값의 raw field 출처가 불명확 | Work24/K-Startup 핵심 필드에 `compare_meta.field_sources` 추가 | 완료 |
| 처리 시간 절감률 | 미계측 | 미계측 | 4~5번 또는 운영 계측 후 산정 |
| 필드 정확도 | 미계측 | 골든 fixture 기반 회귀 검사는 가능, 전체 정확도는 미계측 | 운영 샘플링 필요 |
| OCR 비용 절감 | OCR 미사용 | OCR 미사용 | 5번 적용 후 산정 |

## Boottent 사례와 우리 적용 범위 비교

| Boottent 파이프라인 요소 | Boottent 효과 | 우리 프로젝트 적용 여부 | 이번 차용 방식 |
| --- | --- | --- | --- |
| Fetch URL 검증 | 불필요한 후속 처리 방지 | 부분 적용 | 기존 collector 흐름 유지, 품질 validator로 후속 진단 강화 |
| Retrieve | Playwright로 동적 페이지 렌더링 | 미적용 | 4번에서 source별 필요성 진단 후 검토 |
| Vision OCR | 하이브리드 OCR로 한국어 이미지 처리 | 미적용 | 5번에서 포스터형 공고 source 확인 시 검토 |
| Extract + Validation Agent | 골든 데이터셋 기준 필드 정확도/오류 검출 | 부분 적용 | LLM agent 대신 결정론적 validator와 golden fixture 적용 |
| Ingest | 추출 결과 DB 적재 | 기존 유지 | upsert 경로 변경 없음 |
| Update/Notify | 상태 전이와 알림 | 미적용 | 현재 범위 아님 |

## 1번 적용 효과: 품질 Validator / Dry-Run Summary

변경 파일:

- `backend/rag/collector/quality_validator.py`
- `backend/rag/collector/scheduler.py`
- `backend/tests/test_collector_quality_validator.py`
- `backend/tests/test_scheduler_collectors.py`

향상된 점:

- 수집 row의 `title`, `source`, `source_unique_key`, `source_url`, `provider`, `location`, `region`, `start_date`, `end_date`, cost 계열 필드를 공통 기준으로 점검할 수 있게 됐다.
- Work24의 `deadline=end_date` fallback처럼 즉시 오류로 보기 어려운 케이스를 warning/info로 분리했다.
- `run_all_collectors(upsert=False)` dry-run 결과가 source별 품질 요약을 포함하게 되어, 실제 DB 적재 전 품질 상태를 확인할 수 있다.

성능/운영 효과:

- 적용 전에는 품질 확인이 수동 DB 조회나 로그 해석에 의존했다.
- 적용 후에는 수집 결과를 issue code, severity, summary 형태로 기계적으로 비교할 수 있다.
- 아직 ingestion gate는 아니므로 기존 수집 성공률과 upsert 동작에는 영향을 주지 않는다.

현재 측정 가능한 지표:

- 자동 테스트: `backend/tests/test_collector_quality_validator.py`, `backend/tests/test_scheduler_collectors.py` 포함 검증 통과
- 대표 검증 결과: 관련 테스트 묶음 최대 `32 passed`

아직 미계측인 지표:

- source별 critical issue rate
- dry-run 품질 요약 생성 시간
- 품질 경고가 실제 운영 수정 시간을 얼마나 줄였는지

## 2번 적용 효과: 읽기 전용 품질 리포트 CLI

변경 파일:

- `scripts/program_quality_report.py`
- `backend/tests/test_program_quality_report_cli.py`

향상된 점:

- Supabase REST `GET /rest/v1/programs`를 사용해 저장된 프로그램 row를 읽기 전용으로 점검할 수 있다.
- `--limit`, `--source-query`, `--sample-limit`, `--output` 옵션으로 source별 품질 샘플을 JSON으로 남길 수 있다.
- collector 실행 없이 운영 데이터 품질을 별도 리포트로 만들 수 있다.

성능/운영 효과:

- 품질 검증 로직을 collector dry-run과 DB row 리포트에서 재사용한다.
- 운영자가 특정 source의 품질 하락을 수동 쿼리 없이 반복 측정할 수 있다.
- DB mutation이 없으므로 운영 리스크가 낮다.

현재 측정 가능한 지표:

- 자동 테스트: `backend/tests/test_program_quality_report_cli.py` 포함 검증 통과
- 대표 검증 결과: 관련 테스트 묶음 `25 passed`

아직 미계측인 지표:

- 실제 Supabase 환경에서 100/1,000/10,000 row 리포트 생성 시간
- source별 품질 추세
- 품질 리포트 확인 후 운영 수정 시간 절감률

## 3번 적용 효과: 골든 Fixture

변경 파일:

- `backend/tests/fixtures/program_quality_golden.json`
- `backend/tests/test_program_quality_golden.py`

향상된 점:

- Work24, K-Startup, SeSAC 대표 케이스를 기준으로 validator 정책의 기대 결과를 고정했다.
- 정책 변경 시 warning/info/error code가 의도치 않게 바뀌는지 테스트로 확인할 수 있다.
- Boottent의 골든 데이터셋 기반 품질 평가 방식을 작은 범위로 차용했다.

현재 골든 케이스:

- Work24 `traStartDate` deadline fallback: informational
- Work24 `deadline=end_date` without trusted source: warning
- K-Startup traceable announcement: no quality issues
- SeSAC missing provider: display fallback info

성능/운영 효과:

- 필드 정확도 자체를 대규모로 산정한 단계는 아니지만, 대표 오류 정책의 회귀를 자동으로 감지할 수 있다.
- 동적 Retrieve나 OCR을 도입하기 전에 baseline fixture를 확장할 수 있는 구조가 생겼다.

현재 측정 가능한 지표:

- 골든 fixture 수: 4건
- source family: Work24, K-Startup, SeSAC
- 대표 검증 결과: 관련 테스트 묶음 `14 passed`

아직 미계측인 지표:

- 전체 필드 정확도
- missing / mismatch / hallucination 비율
- validator 오류 검출률

## 3번 확장 적용 효과: 원문 필드 근거 보존

변경 파일:

- `backend/rag/collector/program_field_mapping.py`
- `backend/tests/test_work24_kstartup_field_mapping.py`

향상된 점:

- Work24/K-Startup 정규화 row의 핵심 필드에 대해 어떤 raw field가 source였는지 `compare_meta.field_sources`에 보존한다.
- DB schema 변경 없이 기존 `compare_meta` JSON에 추적 정보를 추가했다.
- 원문 값은 기존 `raw_data`에 두고, `field_sources`는 raw field명만 기록해 payload 증가를 제한했다.

성능/운영 효과:

- 품질 이슈가 발생했을 때 "어떤 원문 필드에서 온 값인가"를 추적할 수 있다.
- 잘못된 매핑과 source 자체의 데이터 결함을 분리해서 판단하기 쉬워졌다.
- 향후 품질 리포트에서 "근거 없음", "fallback 사용", "신뢰 낮은 source field"를 분리할 수 있는 기반이 생겼다.

현재 측정 가능한 지표:

- 적용 source: Work24, K-Startup
- 적용 필드 예: provider, location, region, description, deadline, start/end date, cost, source_url, source_unique_key, application_url
- 대표 검증 결과: 관련 테스트 묶음 `18 passed`

아직 미계측인 지표:

- 전체 row 중 `field_sources` 보유율
- 근거 추적을 통한 운영 디버깅 시간 절감률
- source별 high-risk field 비율

## 현재 단계의 성과 해석

이번 1~3번 작업은 처리량 증가나 사용자-facing 속도 개선보다 품질 측정 가능성을 높인 작업이다. 따라서 "프로그램 목록 API가 빨라졌다"거나 "등록 시간이 몇 퍼센트 줄었다"는 식의 성능 개선으로 표현하면 부정확하다.

정확히 표현할 수 있는 성과는 다음과 같다.

- 수집 결과 품질을 사람이 직접 해석하던 상태에서, issue/severity 기반 구조화 리포트로 전환했다.
- 저장된 프로그램 row에 대해 읽기 전용 품질 리포트를 만들 수 있게 됐다.
- 대표 source의 품질 정책을 골든 fixture로 고정해 회귀 감지가 가능해졌다.
- 정규화 값의 원문 필드 출처를 보존해 디버깅과 신뢰도 판단 기반을 만들었다.
- Bedrock/Step Functions/OCR 없이도 Boottent 사례의 "검증 우선" 원칙을 낮은 리스크로 차용했다.

## 이후 4~5번 완료 시 추가할 측정 항목

4번 동적 페이지 Retrieve 적용 후 추가할 항목:

- static HTML collector 대비 Playwright fallback 성공률
- parse-empty 감소율
- source별 fallback 호출률
- fallback 1회당 평균 소요 시간
- fallback 적용 후 신규 row 증가량
- JS 렌더링 필요 source 목록

5번 이미지/OCR 적용 후 추가할 항목:

- 이미지 기반 공고에서 텍스트 추출 성공률
- OCR 전후 필드 채움률 변화
- OCR 기반 row의 missing/mismatch/hallucination 비율
- OCR provider별 비용
- OCR provider별 오류 유형
- 이미지 처리 1건당 평균 비용과 평균 지연 시간

## 권장 KPI 정의

향후 운영 리포트에서 사용할 수 있는 KPI는 다음과 같다.

| KPI | 정의 | 계산 방식 |
| --- | --- | --- |
| Valid Row Rate | error severity가 없는 row 비율 | `valid_rows / total_rows` |
| Critical Issue Rate | 필수 식별/추적 필드 결함 row 비율 | `critical_issue_rows / total_rows` |
| Traceable Field Rate | `field_sources`가 있는 핵심 필드 비율 | `traceable_fields / required_trace_fields` |
| Source Quality Delta | source별 품질 변화 | `current_issue_rate - previous_issue_rate` |
| Parse Empty Rate | 수집 성공했지만 유효 row가 없는 비율 | `empty_parse_runs / total_runs` |
| Retrieve Fallback Benefit | fallback으로 회수한 row 비율 | `fallback_recovered_rows / fallback_attempts` |
| OCR Fill Lift | OCR 후 채워진 필드 증가율 | `(ocr_filled_fields - text_only_fields) / text_only_fields` |

## 결론

Boottent 사례의 핵심 성과는 자동 입력 시간 절감, 필드 정확도 측정, OCR 비용 최적화였다. 우리 프로젝트의 1~3번 적용은 이 중 "정확도 측정과 검증 기반"을 먼저 가져온 단계다.

따라서 현재 보고서의 결론은 다음과 같다.

- 현재까지는 처리 시간 절감률이나 OCR 비용 절감률을 주장하지 않는다.
- 대신 수집 품질을 구조화해서 측정하고, 회귀를 잡고, 원문 근거를 추적할 수 있게 된 것이 핵심 향상점이다.
- 4번 동적 Retrieve와 5번 OCR이 적용되면, 이 문서에 실제 parse-empty 감소율, fallback 성공률, OCR 비용/정확도 지표를 추가해 Boottent식 성과 리포트로 확장할 수 있다.

