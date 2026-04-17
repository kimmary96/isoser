---
id: TASK-2026-04-16-1100-tier4-district-crawl
status: queued
type: feature
title: "Tier 4 지역구 크롤링 — 서울 자치구 6개 collector 구현 및 scheduler 연결"
priority: high
planned_by: Codex
planned_at: 2026-04-17T15:55:00+09:00
planned_against_commit: ddc1083bf1a82c4ed21ccd313e32106227d663b8
auto_recovery_attempts: 1
planned_files: backend/rag/collector/scheduler.py, backend/rag/collector/tier3_collectors.py, backend/rag/collector/tier4_collectors.py, backend/tests/test_scheduler_collectors.py, backend/tests/test_tier4_collectors.py
planned_worktree_fingerprint: a282bf99d4f7c6b8f288bd66348677603e118c3ddeb392330ddddd090f3ad2ae
---

# Goal

현재 Tier 1~3까지만 등록된 collector 파이프라인에 Tier 4 지역구 수집 계층을 추가한다.

이번 task는 서울 자치구/구 단위 기관 6개 소스를 대상으로 신규 collector를 구현하고, scheduler dry-run 및 parser 단위 테스트까지 포함해 "현재 저장소 기준으로 다시 실행 가능한 packet"으로 마무리하는 것이 목적이다.

# Current Repository Baseline

- 현재 `backend/rag/collector/scheduler.py`에는 Tier 1~3 collector만 등록되어 있다.
- Tier 3 구현은 이미 `backend/rag/collector/tier3_collectors.py`로 분리되어 안정화된 상태다.
- Tier 4 collector 전용 모듈은 아직 없다.
- 기존 drift 사유였던 "Tier 3가 같은 scheduler 영역에서 미완료 상태" 문제는 현재 기준으로 해소됐다.
- 검증한 planned 범위 파일은 현재 worktree에서 clean 상태다.
- 따라서 이 task는 현재 HEAD `ddc1083bf1a82c4ed21ccd313e32106227d663b8` 기준으로 다시 진행 가능하다.

# Fixed Implementation Decisions

- Tier 4 collector는 `backend/rag/collector/tier4_collectors.py` 신설로 구현한다.
- 기존 `tier3_collectors.py`에는 Tier 4 코드를 섞지 않는다.
- scheduler는 현재 tier 정렬 규칙을 유지한 채 Tier 4 collector import/register만 추가한다.
- 검증은 라이브 사이트 의존 smoke가 아니라 fixture 수준의 parser 단위 테스트 + scheduler dry-run 테스트를 필수 기준으로 삼는다.
- 라이브 사이트 접속 확인은 선택적 수동 확인 메모로만 남기고, packet acceptance의 필수 조건으로 두지 않는다.

# User Flow

1. scheduler가 `run_all_collectors(upsert=False)`를 실행한다.
2. Tier 1, Tier 2, Tier 3 다음에 Tier 4 collector가 tier 오름차순으로 실행된다.
3. 각 Tier 4 collector는 목록/메인 섹션 HTML에서 제목, 링크, 마감일, 카테고리 힌트, raw 메타를 추출한다.
4. dry-run에서는 source별 `status`/`message`와 수집 건수만 반환한다.
5. 실제 upsert 경로에서는 기존 normalize 및 Supabase 저장 흐름을 그대로 재사용한다.
6. 개별 Tier 4 collector 실패가 전체 배치를 중단시키지 않는다.

# Scope

## 공통 메타

모든 Tier 4 collector는 아래 고정 메타를 따른다.

```python
source_type = "district_crawl"
collection_method = "web_crawl"
scope = "district"
region = "서울"
tier = 4
is_ad = False
```

- `region_detail`은 각 구 이름으로 고정한다.
- `raw`에는 최소한 재수집 키와 파싱 근거 텍스트를 남긴다.
- `.collect()` 반환 형식은 기존 `BaseHtmlCollector` 패턴을 유지한다.

## 구현 대상 collector 6개

1. `DobongStartupCollector`
   - 소스: `https://dobongstartup.com`
   - 대상: 공지사항 `/bbs/board.php?bo_table=donotic`, 프로그램 `/program/programlist.php`
   - 필수 raw: `pg_id`, `wr_id`, `board_table`, `target_text`, `status_text`
   - 기본 카테고리: `창업`

2. `GuroCollector`
   - 소스: `http://youtheroom.kr`
   - 대상: 프로그램 `/product/list.php?ca_id=10`, 공지 `/bbs/board.php?tbl=bbs41`
   - HTTPS를 기본값으로 쓰지 말고 `http://youtheroom.kr`를 기준 URL로 고정한다.
   - 필수 raw: `mode`, `num`, `ca_id`, `tbl`, `status_text`
   - 키워드 기반 카테고리: `IT`, `취업`

3. `SeongdongCollector`
   - 소스: `https://youth.seoul.go.kr`
   - 대상: `cntrId=CT00006` 고정 프로그램/공지 경로
   - `site=sd` 경로는 사용하지 않는다.
   - 필수 raw: `cntrId`, `pstSn`, `sprtInfoId`, `period_text`, `place_text`
   - 키워드 기반 카테고리: `IT`, `취업`

4. `NowonCollector`
   - 소스: `https://www.nwjob.kr`
   - 대상: 취업정보 board와 메인 프로그램 카드
   - Imweb 특성상 복잡한 class 체인에 덜 의존하고 `/?q=...&bmode=view&idx=...&t=board` 링크 패턴을 우선 사용한다.
   - 필수 raw: `idx`, `q_param`, `board_path`, `status_text`
   - 키워드 기반 카테고리: `취업`, `훈련`

5. `DobongCollector`
   - 소스: `https://www.dobong.go.kr`
   - 대상: `bbs.asp?code=10008769`, `bbs.asp?code=10008770`, 필요 시 메인 배너 보조 파싱
   - 제목 키워드 필터로 일반 구정 공지를 제외한다.
   - 필수 raw: `code`, `page_source`
   - 키워드 기반 카테고리: `취업`, `훈련`

6. `MapoCollector`
   - 소스: `https://mapoworkfare.or.kr`
   - 대상: 메인 페이지 노출 섹션만 사용
   - `/notice` 직접 접근 전제는 두지 않는다.
   - 필수 raw: `page_source`
   - 키워드 기반 카테고리: `취업`, `훈련`

## Scheduler 변경 범위

- `backend/rag/collector/scheduler.py`에 Tier 4 collector import 및 등록 추가
- collector 실행 순서는 기존처럼 `tier` 값 기준 정렬 유지
- Tier 4 collector 실패는 source 단위 실패로만 기록하고 다음 collector로 계속 진행

## 테스트 변경 범위

- `backend/tests/test_tier4_collectors.py` 신설
- 각 collector마다 최소 1개 이상의 inline HTML fixture 테스트를 작성해 파싱 결과를 검증
- `backend/tests/test_scheduler_collectors.py`에 Tier 4가 dry-run 결과에 포함되고 Tier 순서가 유지되는지 확인하는 테스트를 추가
- 외부 네트워크 접속 없이 테스트 가능해야 한다

# Acceptance Criteria

1. `backend/rag/collector/tier4_collectors.py`가 새로 추가되고 6개 collector class를 포함한다.
2. 각 collector는 `BaseHtmlCollector` 기반으로 구현되고 `.collect()` 반환 형식이 기존 normalize 경로와 호환된다.
3. Tier 4 수집 결과에는 `source_type="district_crawl"`, `collection_method="web_crawl"`, `tier=4`, `region="서울"`, `region_detail=<구명>`이 들어간다.
4. `scheduler.run_all_collectors(upsert=False)` 경로에서 Tier 4 collector가 Tier 3 뒤에 포함된다.
5. 개별 Tier 4 collector 예외 또는 빈 결과가 전체 scheduler 실행을 중단시키지 않는다.
6. `backend/tests/test_tier4_collectors.py`에서 6개 collector의 핵심 파싱 규칙이 검증된다.
7. `backend/tests/test_scheduler_collectors.py`에서 Tier 4 registration/order가 검증된다.
8. `GuroCollector` 테스트는 HTTP 기준 URL만 사용하고 HTTPS 의존을 만들지 않는다.
9. `SeongdongCollector` 테스트는 `cntrId=CT00006` 경로만 전제하고 `site=sd` 의존을 만들지 않는다.
10. 결과 보고서에는 라이브 검증 여부와 미실행 사유를 명확히 적는다.

# Constraints

- `BaseCollector`, `BaseHtmlCollector`, `normalize()` 기존 인터페이스를 유지한다.
- 브라우저 자동화는 사용하지 않는다.
- `urllib` + `BeautifulSoup` 기반 구현 패턴을 유지한다.
- 기존 Tier 1~3 collector 동작을 깨지 않는 최소 변경을 우선한다.
- Supabase upsert conflict key는 기존과 같은 `title,source`를 전제로 한다.
- dirty worktree가 있으므로 현재 task와 무관한 기존 수정은 되돌리지 않는다.

# Non-goals

- 각 소스의 본문 상세 페이지 전부 정제
- 첨부파일 다운로드
- 지도/좌표 데이터화
- 글로벌 cross-source dedupe 도입
- 프론트엔드 `/programs` UI 변경
- cron/GitHub Actions 배포 설정 변경

# Edge Cases

- `GuroCollector`: HTTPS가 아니라 HTTP 고정 URL을 사용하고, 테스트도 그 전제를 따른다.
- `SeongdongCollector`: `cntrId=CT00006` 목록이 0건이면 source 단위 실패 메시지를 남기고 다음 collector로 진행한다.
- `NowonCollector`: Imweb selector가 바뀌면 링크 패턴 미탐지 시 빈 배열 반환과 상태 메시지 기록을 허용한다.
- `DobongCollector`: 키워드 필터 미통과 시 0건이 될 수 있으며, 이 경우 필터 결과를 메시지로 남긴다.
- `MapoCollector`: 메인 HTML만 파싱 대상으로 보고 직접 notice/program endpoint 성공을 가정하지 않는다.

# Required Verification

- 우선 검증:
  - `backend\venv\Scripts\python.exe -m pytest backend\tests\test_tier4_collectors.py backend\tests\test_scheduler_collectors.py -q`
- 보조 검증:
  - 가능하면 `backend\venv\Scripts\python.exe -c "from backend.rag.collector.scheduler import run_all_collectors; import json; print(json.dumps(run_all_collectors(upsert=False), ensure_ascii=False)[:2000])"`
- 로컬 환경상 네트워크/패키지 제약 때문에 라이브 확인이 불가능하면 result report에 그 사유를 남기고 fixture 테스트 통과를 주된 검증 근거로 사용한다.

# References

- scheduler baseline: `backend/rag/collector/scheduler.py`
- Tier 3 baseline: `backend/rag/collector/tier3_collectors.py`
- Tier 3 result reference: `reports/TASK-2026-04-16-1000-tier3-semi-public-crawl-result.md`
- previous drift context: `reports/TASK-2026-04-16-1100-tier4-district-crawl-drift.md`
- previous recovery context: `reports/TASK-2026-04-16-1100-tier4-district-crawl-recovery.md`

# Transport Notes

- Current queue location: `tasks/inbox/TASK-2026-04-16-1100-tier4-district-crawl.md`
- Cowork source packet: `cowork/packets/TASK-2026-04-16-1100-tier4-district-crawl.md`
- This packet was replanned against current HEAD `ddc1083bf1a82c4ed21ccd313e32106227d663b8`.
