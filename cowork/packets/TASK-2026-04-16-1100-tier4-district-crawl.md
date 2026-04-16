---
id: TASK-2026-04-16-1100-tier4-district-crawl
status: queued
type: feature
title: "Tier 4 지역구 크롤링 — 서울 자치구 6개 collector 구현 및 scheduler 연결"
priority: high
planned_by: Claude (PM)
planned_at: 2026-04-16T11:00:00+09:00
planned_against_commit: 469cd3f
---

# Goal

Tier 4 지역구 수집 계층으로 서울 자치구 6개 소스의 collector를 신규 구현하고, 기존 scheduler에 Tier 4로 등록한다.

Tier 4는 서울시 광역 허브가 아니라 자치구 밀착 프로그램을 다루는 계층이다. 대상은 구청, 구 단위 청년센터, 구 단위 고용복지센터, 구 단위 창업센터이며, 전국 단위 API 허브와 겹치는 공고보다 구 단위 운영 프로그램을 우선 수집한다.

이번 task는 로컬 검증이 완료된 범위만 구현한다. 6개 소스의 접속 상태와 HTML 구조를 모두 검증했으며, 일부 소스는 접근 경로 주의사항이 확정됐다.

구현 순서는 난이도 기준으로 아래와 같다:
1. `DobongStartupCollector` — 구현 난도 낮음, 구조 명확
2. `GuroCollector` — 구현 난도 낮음, HTTP 우회 필요
3. `SeongdongCollector` — 구현 난도 중간, 우회 경로 고정 필요
4. `NowonCollector` — 구현 난도 중간, Imweb 기반 selector 주의
5. `DobongCollector` — 구현 난도 중상, 키워드 필터 필수
6. `MapoCollector` — 구현 난도 중상, 메인 기반 접근만 가능

# User Flow

이 task는 사용자 직접 노출 기능이 아니라 데이터 수집 파이프라인이다.

1. scheduler가 `run_all_collectors()`를 실행한다.
2. Tier 4 collector가 순서대로 실행된다.
3. 각 collector가 목록 또는 메인 섹션을 파싱해 제목/링크/마감일/카테고리를 추출한다.
4. 정규화 후 `programs` 테이블에 upsert된다.
5. 개별 collector 실패는 전체 배치를 중단시키지 않는다.

# 작업 상세

## 공통 메타 및 스키마

모든 Tier 4 collector가 공유하는 고정값:

```python
source_type = "district_crawl"
collection_method = "web_crawl"
scope = "district"
region = "서울"
tier = 4
is_ad = False
```

공통 raw 보존 필드:
- `posted_at`
- `status_text`
- `period_text`
- `target_text`
- `place_text`
- `board_id`
- `page_source`

`region_detail`에 각 구 이름을 고정 저장한다 (예: `"도봉구"`, `"구로구"`).

## 작업 1 — DobongStartupCollector

**소스:** 도봉창업센터 `https://dobongstartup.com`

**수집 대상:**
- 공지사항: `/bbs/board.php?bo_table=donotic`
- 프로그램 신청: `/program/programlist.php`

**추출 필드:**
- `title`, `link`, `deadline` (신청마감), `program_period`, `target_text`, `status_text`
- `raw` — `{pg_id, wr_id, board_table}`

**카테고리:** 기본값 `창업`

**주의:**
- 입주기업 전용 프로그램과 일반 공개 프로그램이 섞임 → `raw.target_text`로 보존 후 후처리에서 분리 가능하게 둔다
- `pg_id`, `wr_id`를 raw에 반드시 보존 (재수집 안정성)

## 작업 2 — GuroCollector

**소스:** 구로 청년이룸 `http://youtheroom.kr` (HTTPS TLS 오류 확인됨)

**수집 대상:**
- 프로그램 목록: `/product/list.php?ca_id=10`
- 공지사항: `/bbs/board.php?tbl=bbs41`

**추출 필드:**
- `title`, `link`, `deadline`, `status_text`
- `raw` — `{mode, num, ca_id, tbl}`

**카테고리:** `IT`, `취업` (제목 키워드 기반 분류)
- `AI`, `VR`, `개발`, `디지털`, `마케팅`, `데이터` → `IT`
- `취업`, `면접`, `커리어`, `컨설팅`, `상담` → `취업`

**주의:**
- base URL은 반드시 `http://youtheroom.kr` (HTTPS 사용 금지, 현재 TLS 오류)
- 로그인 전용 메뉴 (`AI 자소서/면접`, `취업솔루션`) 접근 시도하지 않는다
- `/bbs/board.php?tbl=bbs41` 상세 링크 패턴: `mode=VIEW&num=`

## 작업 3 — SeongdongCollector

**소스:** 서울청년센터 성동 `https://youth.seoul.go.kr`

**수집 대상:**
- 프로그램: `/orang/cntr/program.do?key=2309210001&cntrId=CT00006`
- 공지: `/orang/cntr/notice.do?key=2309210001&cntrId=CT00006`

**추출 필드:**
- `title`, `link`, `status_text`, `period_text`, `place_text`
- `raw` — `{cntrId: "CT00006", pstSn, sprtInfoId}`

**카테고리:** `IT`, `취업`
- `IT`, `AI`, `개발`, `디지털` → `IT`
- `취업`, `일경험`, `커리어`, `면접` → `취업`

**주의:**
- 반드시 `cntrId=CT00006`를 고정 파라미터로 사용 (성동 센터 식별자)
- 사용자 제공 경로 `index.do?site=sd`는 현재 302 → 404이므로 사용 금지
- 오랑 플랫폼 공통 구조 — 성동이 아닌 타 센터 데이터 혼입 주의, 제목에 `성동` 포함 여부 또는 cntrId 기반으로 필터링

## 작업 4 — NowonCollector

**소스:** 노원구 청년일자리센터 청년내일 `https://www.nwjob.kr`

**수집 대상:**
- 취업정보: `/18` 또는 해당 board 경로
- 메인 프로그램 카드 (보조)

**추출 필드:**
- `title`, `link`, `deadline`, `status_text`
- `raw` — `{idx, q_param, board_path}`
- 링크 패턴: `/?q=...&bmode=view&idx=...&t=board`

**카테고리:** `취업`, `훈련`
- `취업`, `면접`, `자소서`, `커리어`, `사진촬영` → `취업`
- `클래스`, `교육`, `과정`, `AI` → `훈련`

**주의:**
- Imweb 기반 생성 HTML로 class 체인이 길다 — selector를 최대한 좁고 단순하게 잡는다
- `href=\"/?q=...&bmode=view&idx=...&t=board\"` 패턴을 기본 링크 키로 사용

## 작업 5 — DobongCollector

**소스:** 도봉구청 일자리경제과 `https://www.dobong.go.kr`

**수집 대상:**
- 공지사항: `bbs.asp?code=10008769`
- 행사/모집: `bbs.asp?code=10008770`
- 메인 배너/팝업 중 일자리/취업/교육 관련 링크 (보조)

**추출 필드:**
- `title`, `link`, `deadline`
- `raw` — `{code, page_source}`

**카테고리:** `취업`, `훈련`

**키워드 필터 (title 기준):**
- 포함 시 수집: `취업`, `일자리`, `아카데미`, `자격증`, `교육`, `창업`, `지역경제과`, `훈련`
- 필터 미통과 항목은 수집하지 않는다 (일반 구정 공지 제외)

**주의:**
- 구청 전체 게시판 크롤링이 아니라 일자리/취업/교육 키워드 기반 필터 수집 방식
- 메인 배너 기반 항목은 링크만 저장하고 상세 재진입은 2차로 미룬다

## 작업 6 — MapoCollector

**소스:** 마포구고용복지지원센터 `https://mapoworkfare.or.kr`

**수집 대상:**
- 메인 페이지 프로그램/공지 섹션 (`GET /` 기반)
- 메인에서 노출된 상세 URL 직접 저장 (`/program/...`, `/notice/...`)

**추출 필드:**
- `title`, `link`, `deadline`
- `raw` — `{page_source: "main"}`

**카테고리:** `취업`, `훈련`

**키워드 필터:**
- `청년도전`, `취업`, `교육`, `자격증`, `컴퓨터`, `일준비`, `채용` 포함 시 수집

**주의:**
- `/notice` 직접 GET 호출 시 403 → 메인 페이지 파싱 기반으로만 접근
- `HEAD` 요청으로 health check 시 405/403 오탐 발생 → health check를 `GET` 기반으로 단순화
- 생활문화교육과 취업훈련이 혼재 → 키워드 필터 필수, 통과 못 하면 버린다

## 작업 7 — scheduler 등록

**파일:** `backend/rag/collector/scheduler.py`

- 6개 Tier 4 collector를 import 및 등록
- Tier 1 → Tier 2 → Tier 3 → Tier 4 순서로 실행
- 개별 Tier 4 collector 실패 시 다음 collector로 진행, 전체 배치 중단 없음

# Acceptance Criteria

1. 6개 collector 각각이 `run_all_collectors(upsert=False)` 실행 시 포함된 결과가 출력된다.
2. `DobongStartupCollector`가 공지 또는 프로그램 목록에서 1건 이상 추출한다.
3. `GuroCollector`가 프로그램 목록에서 1건 이상 추출한다 (HTTP 기준).
4. `SeongdongCollector`가 `cntrId=CT00006` 기반으로 성동 프로그램 목록에서 1건 이상 추출한다.
5. `NowonCollector`가 취업정보 또는 메인 카드에서 1건 이상 추출한다.
6. `DobongCollector`가 키워드 필터를 통과한 항목 1건 이상을 추출한다.
7. `MapoCollector`가 메인 기반 파싱으로 프로그램/공지 항목 1건 이상을 추출한다.
8. 모든 Tier 4 수집 결과에 `source_type='district_crawl'`, `tier=4`, `region='서울'`, `region_detail=구명`이 포함된다.
9. 개별 collector 실패가 전체 배치를 중단시키지 않는다.
10. 수집 실패 시 기존 DB 데이터는 변경되지 않는다.
11. GuroCollector HTTPS 시도 시 오류가 발생해도 HTTP fallback 또는 HTTP 고정으로 정상 수집된다.
12. SeongdongCollector가 `site=sd` 경로 시도 없이 `cntrId=CT00006` 경로를 기준으로만 동작한다.

# Constraints

- `BaseCollector` 또는 `BaseHtmlCollector` 기존 인터페이스(`.collect()` 반환 형식) 준수
- `urllib` + `BeautifulSoup` 기반 구조 유지 (브라우저 자동화 사용 금지)
- Supabase upsert 중복 기준: `on_conflict: "title, source"` — 기존 코드와 동일
- Render 512MB 메모리 제약 감안, 페이지 단위 배치 처리 유지
- 환경 변수 추가 불필요 (별도 API 키 없음)
- 기존 Tier 1, Tier 2, Tier 3 collector 동작에 영향 없음

# Non-goals

- 각 소스 상세 본문 전체 정제 (2차 범위)
- 첨부파일 다운로드
- 지도/장소 좌표화
- 다중 상세 페이지 추가 탐색
- 프론트엔드 `/programs` 허브 UI 변경
- `compare_meta` 필드 채우기
- 수집 자동화 cron/GitHub Actions 설정
- SeongdongCollector의 타 구 센터(`cntrId` 다른 센터) 수집

# Edge Cases

- `GuroCollector` HTTPS 접근 시 TLS 오류: HTTP fallback으로 재시도 또는 HTTP 기준 고정, 로그에 "HTTPS 비정상, HTTP 전환" 기록
- `SeongdongCollector`에서 `cntrId=CT00006` 경로가 비어 있는 경우: 파싱 실패 처리, 로그에 "성동 센터 목록 0건 또는 경로 변경 의심" 기록
- `MapoCollector` GET 메인 요청 자체가 차단된 경우: 재시도 없이 실패 처리, 다음 collector 진행
- `DobongCollector` 키워드 필터 전체 미통과: 수집 0건으로 기록, 정상으로 간주하지 않고 로그에 필터 결과 기록
- `NowonCollector` Imweb HTML 구조 변경으로 링크 패턴 미탐지: 빈 배열 반환, 로그에 "selector 오탐 의심" 기록
- 동일 프로그램을 여러 구 센터가 재게시: `source + title + deadline` 기준으로 구별, 동일 title이라도 source가 다르면 별건으로 취급
- 3회 연속 수집 0건: HTML 구조 변경 또는 접근 정책 변경으로 간주, 운영 메모에 기록

# Open Questions

1. `tier4_collectors.py`를 별도 파일로 분리할지, `tier3_collectors.py`와 합칠지 — Tier 3 파일 크기 확인 후 판단
2. `DobongCollector` 메인 배너 파싱의 실제 안정성 — 구현 중 확인 후 메인 배너 수집 포함 여부 결정
3. 글로벌 dedupe 도입 시점 — `SeongdongCollector`와 `GuroCollector`의 외부 연계 프로그램 재게시 중복이 실제로 얼마나 발생하는지 1차 수집 결과 보고 결정
4. `MapoCollector` 메인 기반 파싱만으로 장기 안정적인지 — 2차에서 `/program` 직접 경로 접근 가능 여부 재검증 필요

# Transport Notes

- Local execution target: `tasks/inbox/TASK-2026-04-16-1100-tier4-district-crawl.md`
- Remote fallback target: `tasks/remote/TASK-2026-04-16-1100-tier4-district-crawl.md`
- 실행 전 현재 HEAD가 `469cd3f`인지 확인한다. 다른 commit이면 drift 검토 후 `planned_against_commit`을 실제 HEAD로 교체하고 영향받는 섹션을 재검토한다.
- 참조 문서: `cowork/drafts/isoser-tier4-local-district-crawling-validated.md` 또는 업로드된 검증 기획안 전문
- 선행 task: `TASK-2026-04-15-1500-tier2-seoul-crawl` (Tier 2 scheduler 구조 확인 필요), `TASK-2026-04-16-1000-tier3-semi-public-crawl` (Tier 3 등록 이후 Tier 4 연결 권장)

## Auto Recovery Context

- source_task: `tasks/drifted/TASK-2026-04-16-1100-tier4-district-crawl.md`
- failure_stage: `drift`
- failure_report: `reports/TASK-2026-04-16-1100-tier4-district-crawl-drift.md`
- recovery_report: `reports/TASK-2026-04-16-1100-tier4-district-crawl-recovery.md`
- reviewer_action: update the packet or provide approval/feedback before requeueing
