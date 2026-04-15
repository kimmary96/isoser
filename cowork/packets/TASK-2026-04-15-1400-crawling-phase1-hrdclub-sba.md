---
id: TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba
status: queued
type: feature
title: 수집 파이프라인 Phase 1 — normalizer 버그 수정 + HrdClub scheduler 등록 + SBA collector 신규
priority: high
planned_by: claude
planned_at: 2026-04-15T14:00:00+09:00
planned_against_commit: 78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3
---

# Goal

현재 수집 파이프라인에서 즉시 수정 및 구현 가능한 세 가지 작업을 하나의 Task로 처리한다.

1. `normalizer.py`의 `is_ad` / `sponsor_name` 하드코딩 버그 수정 — 이 버그가 있으면 HRD클럽 광고 데이터가 `is_ad=false`로 저장되어 일반 프로그램처럼 분류된다.
2. `scheduler.py`에 `HrdClubCollector`를 등록 — 현재 scheduler는 HrdClubCollector를 import하지 않는다. 등록되지 않으면 scheduler 실행 시 HRD클럽 데이터가 수집되지 않는다.
3. `SbaCollector` 신규 작성 — 현재 저장소에 `sba_collector.py`가 없다. 검증을 통해 SBA 메인 페이지에서 목록형 사업공고 크롤링이 가능함을 확인했다.

세 작업은 각각 독립적으로 수행 가능하지만, 완료 순서는 위 번호 순서를 권장한다. normalizer가 수정되지 않으면 HrdClub 데이터가 올바르게 저장되지 않는다.

# User Flow

이 Task는 사용자 향 UI가 없다. 수집 파이프라인 내부 수정이다.

- 관리자 또는 개발자가 `run_all_collectors(upsert=True)`를 실행하거나 `POST /admin/programs/sync`를 호출한다
- HRD클럽 수집 결과에서 `is_ad=true`인 항목이 DB에 올바르게 저장된다
- SBA 사업공고 목록이 `source_type='regional_crawl'`로 DB에 저장된다
- 프론트엔드 `/programs`에서 두 소스의 데이터가 정상 노출된다

# 작업 상세

## 작업 1 — normalizer.py 버그 수정

**파일:** `backend/rag/collector/normalizer.py`

**현재 문제 코드:**

```python
"is_ad": False,          # raw_item 값 무시, 하드코딩
"sponsor_name": None,    # raw_item 값 무시, 하드코딩
```

**수정 방향:**

```python
"is_ad": raw_item.get("is_ad", False),
"sponsor_name": raw_item.get("sponsor_name"),
```

**주의 사항:**
- 기존 collector가 `is_ad`나 `sponsor_name`을 raw_item에 넣지 않아도 동작에 문제 없어야 한다 (기본값 `False`, `None` 유지)
- HrdClubCollector가 raw_item에 `is_ad=True`, `sponsor_name=기관명`을 넣도록 별도 확인 필요

## 작업 2 — HrdClubCollector scheduler 등록

**파일:** `backend/rag/collector/scheduler.py`

**현재 상태:** `HrdClubCollector`가 import되지 않음. `run_all_collectors` 실행 시 HRD클럽 데이터가 수집되지 않음.

**수정 방향:**

- `HrdClubCollector`를 import하고 collector 목록에 추가
- tier 구분이 있다면 HRD클럽은 tier 2 (보완 크롤링) 으로 분류
- scheduler 실행 시 HRD클럽 수집이 나머지 collector와 함께 실행되어야 한다

**주의 사항:**
- HRD클럽 수집 실패가 전체 scheduler 실행 실패로 이어지지 않게 한다
- 실패 시 로그에 소스 이름과 에러를 기록하고 다음 collector로 진행한다

## 작업 3 — SbaCollector 신규 작성

**파일:** `backend/rag/collector/sba_collector.py` (신규)

**검증 결과:**
- SBA 메인 페이지 HTTP 요청 성공
- 사업공고 영역에서 5건 추출 확인 (제목 / 링크 / 날짜)
- 추출 가능 예시: "2026 M+ 국내 글로벌 진출 역량 강화 지원 협력 파트너 모집"

**구현 범위:**

1차: 목록 수집 (제목, 링크, 날짜)
- 메인 페이지 HTML 파싱
- User-Agent 헤더 포함 (브라우저 식별자)
- 요청 간격 1~2초 유지

2차 (선택): 상세 수집
- 필요한 공고만 상세 페이지 진입
- target, 접수 상태, 카테고리 추출

**저장 형식:**

```python
{
    "source": "SBA",
    "source_type": "regional_crawl",
    "collection_method": "web_crawl",
    "scope": "seoul",
    "title": "사업공고 제목",
    "link": "https://...",
    "deadline": "YYYY-MM-DD 또는 null",
    "category": "창업",       # 이소서 카테고리로 변환, 변환 불가 시 "기타"
    "is_ad": False,
    "raw": { ... }            # 원본 응답 전체 보관
}
```

**주의 사항:**
- HTML 구조 변경 가능성이 있으므로 파싱 실패 시 예외를 잡아 로그 후 빈 배열 반환
- 파싱 결과 0건은 정상으로 간주하지 않는다. 원인을 구분해 로그에 기록한다
- scheduler.py에 SbaCollector도 함께 등록 (tier 2)
- Render 512MB 메모리 제약 감안. 페이지 단위 배치 처리 유지

# Acceptance Criteria

1. `normalizer.py`에서 `is_ad`와 `sponsor_name`이 `raw_item.get()`으로 읽힌다
2. HrdClubCollector가 raw_item에 `is_ad=True`를 담아 보내면 DB에 `is_ad=true`로 저장된다
3. `run_all_collectors(upsert=False)`를 실행했을 때 HrdClubCollector가 포함된 결과가 출력된다 (scheduler 미등록 상태가 아님)
4. SbaCollector가 SBA 메인 페이지에서 1건 이상 사업공고를 추출한다
5. SBA 추출 결과가 `source_type='regional_crawl'`로 정규화된다
6. HRD클럽 또는 SBA 수집 실패가 전체 scheduler 실행을 중단시키지 않는다
7. 수집 실패 시 기존 DB 데이터는 변경되지 않는다
8. 각 collector 실행 결과에서 소스 이름, 수집 건수, 실패 건수를 로그로 확인할 수 있다

# Constraints

- `normalizer.py` 수정은 기존 collector (HrdCollector, Work24Collector, KstartupApiCollector) 동작에 영향을 주지 않아야 한다
- `scheduler.py`의 기존 등록 collector 실행 순서와 구조는 변경하지 않는다
- SbaCollector는 기존 collector 인터페이스(`.collect()` 메서드 반환 형식)와 동일하게 작성한다
- 환경 변수 키는 `.env.example` 기준: SBA는 별도 API 키가 없으므로 추가 환경 변수 불필요
- Supabase upsert 중복 기준: `on_conflict: "title, source"` — 기존 코드와 동일

# Non-goals

- HRD클럽 광고 데이터의 프론트엔드 표시 로직 변경 (`is_ad` 배지 UI는 programs hub Task 범위)
- SBA 상세 페이지 크롤링 (2차 목록 상세 수집은 별도 Task)
- 수집 자동화 (cron / GitHub Actions scheduler)
- 고용24 / HRD-Net / K-Startup API 연동 (별도 Phase 2 Task)
- `compare_meta` 필드 채우기 (별도 Task)

# Edge Cases

- HRD클럽 HTML 구조가 변경된 경우: 파싱 실패 예외를 잡고 `saved: 0, failed: 0` 반환. 로그에 구조 변경 의심 메시지 기록
- SBA 메인 페이지 접근 차단 (403/429): 재시도 없이 실패로 처리. 로그에 HTTP 상태 기록
- `is_ad` 필드가 없는 raw_item: `raw_item.get("is_ad", False)`의 기본값 `False`로 처리
- SBA 사업공고 0건: 정상으로 간주하지 않음. "공고 없음인지 파싱 실패인지" 원인 구분이 로그에 있어야 한다
- scheduler에 HrdClubCollector 등록 후 dry run 17건이 반환되지 않는 경우: HRD클럽 메인 페이지 응답 구조 변경 여부 확인

# Open Questions

1. HrdClubCollector의 raw_item에 현재 `is_ad`, `sponsor_name` 키가 실제로 포함되어 있는지 코드 확인 필요. 없다면 HrdClubCollector에서 해당 키를 raw_item에 추가하는 작업도 병행해야 한다
2. SBA 사업공고 상세 진입 시 추출 가능한 필드 범위 — 1차 목록 수집 이후 실제 상세 HTML 구조 확인 필요
3. scheduler.py의 tier 구조 방식 — `HrdClubCollector`와 `SbaCollector`의 tier 번호를 기존 구조와 어떻게 맞출지 확인 필요

# Transport Notes

- Local execution target: `tasks/inbox/TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba.md`
- Remote fallback target: `tasks/remote/TASK-2026-04-15-1400-crawling-phase1-hrdclub-sba.md`
- 실행 전 현재 HEAD가 `78e4bf6f260ed0ada3481d4d921e6ee5f4c643f3`인지 확인한다. 다른 commit이라면 drift 검토 후 `planned_against_commit`을 실제 HEAD로 교체하고 영향받는 섹션을 재검토한다
- 참조 문서: `cowork/reviews/isoser-crawling-plan-reviewed.md` (섹션 4-1, 4-2, 6-2, 6-3, 15)
