---
id: TASK-2026-04-15-1420-crawling-phase2-api-validation
status: queued
type: feature
title: 수집 파이프라인 Phase 2 — HRD-Net / 고용24 / K-Startup API 엔드포인트 검증 및 수집 연동
priority: medium
planned_by: claude
planned_at: 2026-04-15T14:20:00+09:00
planned_against_commit: 78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3
---

# Goal

현재 저장소에는 세 개의 공식 API collector(`hrd_collector.py`, `work24_collector.py`, `kstartup_collector.py`)가 존재하지만, 실제 API 키 주입 상태에서 정상 응답을 반환하는지 검증되지 않았다. 이 Task는 각 API에 실제 키를 주입해 응답 구조를 확인하고, 응답과 normalizer 간의 필드 매핑을 완성하는 작업이다.

세 API 중 하나라도 응답 구조가 기대와 다르면 해당 collector만 수정하고 나머지는 영향을 받지 않게 한다.

**선행 조건:**

- `TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba` 완료 (normalizer 수정이 선행되어야 한다)
- 각 API 키 발급 완료: `HRD_API_KEY`, `WORK24_API_KEY`, `KSTARTUP_API_KEY`
- API 키는 `backend/.env`에만 저장. 코드에 직접 작성 금지

이 Task는 키 발급 전에는 시작하지 않는다.

# User Flow

이 Task도 사용자 향 UI가 없다. 수집 파이프라인 내부 검증 및 수정이다.

- 개발자가 `backend/.env`에 API 키를 설정한다
- `run_all_collectors(upsert=False)`로 dry run을 실행한다
- 세 API 소스에서 각각 1건 이상 데이터가 반환되는지 확인한다
- normalizer를 통과한 데이터가 programs 테이블 스키마에 맞는 형식인지 확인한다
- upsert=True 실행 후 Supabase `programs` 테이블에 데이터가 저장되는지 확인한다
- `/programs` 페이지에서 세 소스 데이터가 정상 노출된다

# 작업 상세

## 작업 1 — HRD-Net API 엔드포인트 검증 및 수정

**파일:** `backend/rag/collector/hrd_collector.py`

**현재 상태:**
- API 승인 완료 상태
- 현재 코드의 엔드포인트: `https://www.hrd.go.kr/jsp/HRDP/HRDPO00/HRDPOA60/HRDPOA60_1.jsp`
- 실제 키를 주입한 상태에서 응답이 반환되는지 미확인

**검증 절차:**
1. `HRD_API_KEY`를 `backend/.env`에 설정
2. HRD-Net collector 단독 실행: `HrdCollector().collect()`
3. HTTP 상태, 응답 구조 (JSON 키, 페이지네이션 파라미터) 확인
4. 응답 필드가 normalizer의 기대 입력과 일치하는지 비교

**수정이 필요할 수 있는 경우:**
- 엔드포인트 URL이 실제와 다를 때
- 응답 JSON 키명이 collector 코드와 다를 때
- 페이지네이션 파라미터명이 다를 때 (예: `pageNo` vs `page`, `numOfRows` vs `pageSize`)

**참고:**
- 구현 러너가 data.go.kr 문서에서 실제 파라미터명을 확인 후 결정
- 응답 구조 변경 가능성에 대비해 `raw` JSONB에 원본 응답 전체 보관 유지

## 작업 2 — 고용24 API 경로 재확인 및 수정

**파일:** `backend/rag/collector/work24_collector.py`

**현재 상태:**
- 현재 코드 경로에서 404 또는 기대 외 응답 발생 확인
- `WORK24_API_KEY`는 환경 변수에 존재하나 실제 응답 반환 미확인

**검증 절차:**
1. `WORK24_API_KEY`를 `backend/.env`에 설정
2. Work24 collector 단독 실행
3. HTTP 상태 코드 및 응답 바디 확인
4. 404인 경우: 고용24 공식 API 문서에서 현재 유효한 엔드포인트 경로 확인
5. 경로 확인 후 `work24_collector.py` 수정

**주의 사항:**
- 고용24 API는 data.go.kr 또는 www.work24.go.kr 기반 URL을 사용할 수 있음. 구현 러너가 최신 문서 기준으로 확인
- 크롤링 대체안으로 전환하지 않는다. API 경로 확인 전까지 보류

## 작업 3 — K-Startup API payload 구조 확인 및 수정

**파일:** `backend/rag/collector/kstartup_collector.py`

**현재 상태:**
- 키 없는 호출 실패만 확인됨. 응답 구조 미확인
- `KSTARTUP_API_KEY` 발급 필요

**검증 절차:**
1. `KSTARTUP_API_KEY`를 `backend/.env`에 설정
2. KstartupApiCollector 단독 실행
3. 응답 payload 구조 확인 (지원 사업 목록 필드명, 페이지네이션 방식)
4. normalizer 입력으로 넘기기 전 필드 매핑 확인 및 수정

## 작업 4 — normalizer 필드 매핑 완성

**파일:** `backend/rag/collector/normalizer.py`

**현재 Phase 1에서 수정:**
- `is_ad`, `sponsor_name` 하드코딩 제거

**이번 Phase 2에서 추가 확인:**
- 세 API의 실제 응답 필드가 normalizer의 `raw_item.get(...)` 키와 일치하는지 대조
- 불일치하는 경우: normalizer에서 각 소스별 필드명 분기 처리 또는 collector에서 정규화 후 normalizer로 전달하는 방식 중 택일
- `category` 매핑: HRD-Net의 직종 코드(또는 분류 필드)를 이소서 카테고리(AI·데이터 / IT·개발 / 디자인 / 경영·마케팅 / 창업 / 기타)로 변환하는 로직 작성. 변환 불가 시 "기타"로 fallback

# Acceptance Criteria

1. HRD-Net API에서 실제 키 주입 후 1건 이상 데이터가 반환된다
2. 고용24 API에서 실제 키 주입 후 404가 아닌 정상 응답이 반환된다
3. K-Startup API에서 실제 키 주입 후 1건 이상 지원 사업 데이터가 반환된다
4. `run_all_collectors(upsert=False)` 실행 시 세 소스가 각각 0건 초과 결과를 반환한다
5. normalizer를 통과한 데이터가 `programs` 테이블 컬럼 형식과 일치한다
6. `run_all_collectors(upsert=True)` 실행 후 Supabase `programs` 테이블에 각 소스 데이터가 저장된다
7. 중복 실행 시 `on_conflict: "title, source"` 기준으로 upsert되어 중복 행이 생기지 않는다
8. 한 소스 수집 실패가 나머지 소스 수집을 중단시키지 않는다
9. API 키 미설정 시 해당 collector는 skip되고 "키 없음" 로그가 기록된다
10. `category` 매핑에서 변환 불가 코드가 "기타"로 fallback 처리된다

# Constraints

- API 키는 `backend/.env`의 `.env.example` 기준 키 이름으로만 관리: `HRD_API_KEY`, `WORK24_API_KEY`, `KSTARTUP_API_KEY`
- 코드에 API 키 직접 작성 금지
- 엔드포인트 URL 수정은 해당 collector 파일에만 국한한다. scheduler나 normalizer의 범위를 벗어나지 않는다
- Render 무료 티어 512MB 제약: 수집 시 페이지 단위 배치 처리. 전체 응답을 한 번에 메모리에 올리지 않는다
- Supabase upsert on_conflict 기준: `"title, source"` — 변경 금지
- 크롤링 대체안 전환 금지: 고용24 경로 오류가 해결되지 않으면 수집을 0건으로 두고 보고서에 명시

# Non-goals

- HRD-Net / 고용24 / K-Startup HTML 크롤링 대체 구현
- 수집 자동화 (cron, GitHub Actions)
- `compare_meta` 필드 자동 수집 (별도 Task)
- 프론트엔드 UI 변경
- 세 API 외 신규 소스 추가 (SBA는 Phase 1 Task 담당)

# Edge Cases

- API 응답에서 페이지네이션이 없거나 전체 건수 필드가 없는 경우: 응답 구조 재확인 후 collector 수정
- HRD-Net 카테고리 코드가 이소서 카테고리에 매핑되지 않는 경우: "기타" fallback
- API 응답이 XML 형식인 경우: collector에서 JSON 변환 처리 또는 XML 파싱으로 전환
- `deadline` 필드가 응답에 없는 경우: null로 저장하고 프론트에서 "미정" 처리
- 수집 건수가 기대보다 급격히 줄어든 경우 (예: 이전 100건 → 0건): 정상으로 간주하지 않음. 로그에 이전 건수와 비교해 이상 감지
- 교차 소스 중복 (HRD-Net과 고용24 동일 프로그램 수록): `title + source`가 다르므로 별개 행으로 저장됨. 프론트엔드 중복 노출은 MVP에서 `title + deadline` 필터로 처리 (DB 레벨 해결은 후순위)

# Open Questions

1. HRD-Net 직종 코드 필드명과 이소서 카테고리 매핑 기준 — 구현 러너가 실제 응답 확인 후 결정. 확인 전까지 매핑 로직 하드코딩 금지
2. 고용24 API의 현재 유효한 엔드포인트 — data.go.kr 또는 work24.go.kr 기반인지 구현 러너가 공식 문서에서 확인 필요
3. K-Startup payload에 지원 대상(창업 단계, 연령 제한 등) 필드가 포함되는지 — 포함 시 `compare_meta`와의 연동 가능성 검토
4. 세 API의 일일 호출 한도 — 수집 주기 결정에 영향. 확인 후 별도 운영 문서에 기록

# Transport Notes

- Local execution target: `tasks/inbox/TASK-2026-04-15-1420-crawling-phase2-api-validation.md`
- Remote fallback target: `tasks/remote/TASK-2026-04-15-1420-crawling-phase2-api-validation.md`
- 선행 Task: `TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba` 완료 후 진행
- 실행 전 현재 HEAD가 `78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3`인지 확인한다. 다른 commit이라면 drift 검토 후 `planned_against_commit`을 실제 HEAD로 교체하고 영향받는 섹션을 재검토한다
- 참조 문서: `cowork/reviews/isoser-crawling-plan-reviewed.md` (섹션 2-3, 4-4, 4-5, 4-6, 5, 6-1, 8-1)
