---
id: TASK-2026-04-16-1000-tier3-semi-public-crawl
status: queued
type: feature
title: "Tier 3 준공공 창업 특화 크롤링 — KobiaCollector + KisedCollector 구현 및 scheduler 연결"
priority: high
planned_by: Claude (PM)
planned_at: 2026-04-16T10:00:00+09:00
planned_against_commit: 9c25b1edf6392821c77aac60968a5bef6cb46ad5
auto_recovery_attempts: 2
---

# Goal

Tier 3 준공공 창업 특화 수집 계층으로 `KobiaCollector`와 `KisedCollector`를 신규 구현하고, 기존 scheduler에 Tier 3로 등록한다.

Tier 3는 정부 직할 API가 아니라 준공공 창업 특화 기관이 자체 사이트에서 제공하는 창업/보육/지원공고 정보를 HTML 크롤링으로 수집하는 계층이다.

이번 task는 로컬 검증이 완료된 범위만 구현한다. 검증 결과:
- KOBIA `http://www.kobia.or.kr` — HTTP 200, 공지사항 목록 구조 안정 확인
- KISED `https://www.kised.or.kr` — HTTPS 정상, 사업공고 목록 HTML 렌더링 확인

두 collector 모두 목록 수집 + 링크 저장 + 마감일 파생 + 기본 카테고리 분류를 1차 범위로 한다.

현재 HEAD에는 이 task가 목표로 하는 Tier 3 관련 파일이 이미 존재한다. 다음 watcher run은 `backend/rag/collector/tier3_collectors.py`, `backend/rag/collector/scheduler.py`, `backend/tests/test_tier3_collectors.py`, `backend/tests/test_scheduler_collectors.py`의 현재 상태를 먼저 검토한 뒤, 누락된 구현과 검증만 보완해야 한다. 기존 구현을 덮어쓰거나 새 파일을 다시 생성하는 방식으로 진행하지 않는다.

# User Flow

이 task는 사용자 직접 노출 기능이 아니라 데이터 수집 파이프라인이다.

1. scheduler가 `run_all_collectors()`를 실행한다.
2. Tier 3 collector가 순서대로 실행된다 (KOBIA → KISED).
3. 각 collector가 목록 페이지를 파싱해 제목/링크/마감일/카테고리를 추출한다.
4. 정규화 후 `programs` 테이블에 upsert된다.
5. 개별 collector 실패는 전체 배치를 중단시키지 않는다.

# 작업 상세

## 작업 1 — KobiaCollector 구현

**파일:** `backend/rag/collector/tier3_collectors.py` (현재 HEAD에 파일이 있으므로 해당 파일을 기준으로 보완)

**수집 대상:**
- 공지사항 목록: `http://www.kobia.or.kr/board/list.do?board_kind=KNOTICE`
- 상세 URL 패턴: `http://www.kobia.or.kr/board/view.do?idx={idx}&board_kind=KNOTICE&page=1`

**추출 필드:**
- `title` — 공지 제목
- `link` — 상세 URL (idx 기반 조립)
- `raw_deadline` — 목록 등록일 (`posted_at`) 우선, 제목 내 날짜 파싱 보조
- `category` — 기본값 `창업`, 제목 키워드 기반 세분화
  - `교육`, `매니저`, `자격`, `시험` 포함 시 → `훈련`
  - `경진대회`, `설명회`, `네트워킹` 포함 시 → `행사/네트워킹`
- `target` — `예비창업자`, `초기창업기업`, `창업보육센터`, `창업전문매니저`
- `source_meta` — `{"source": "KOBIA", "tier": 3, "board_kind": "KNOTICE"}`
- `raw` — `{idx, board_kind, posted_at, label}`

**메타 고정값:**
```python
source = "KOBIA"
source_type = "semi_public_crawl"
collection_method = "web_crawl"
scope = "national"
region = "전국"
tier = 3
```

**주의:**
- 기준 도메인은 반드시 `http://www.kobia.or.kr` (HTTPS 443 포트 연결 거부 확인됨)
- `https://www.kabit.or.kr`는 구 도메인이므로 collector 대상에서 제외
- HTTP 평문 사용이므로 User-Agent 헤더 포함
- 파싱 실패 시 빈 배열 반환, 로그에 소스명과 원인 기록

## 작업 2 — KisedCollector 구현

**파일:** `backend/rag/collector/tier3_collectors.py` (현재 HEAD의 기존 구현을 이어서 보완)

**수집 대상:**
- 사업공고 목록: `https://www.kised.or.kr/misAnnouncement/index.es?mid=a10302000000`

**수집 방식:**
- KISED 내부 목록에서 제목/사업기간/기관명/외부링크 수집
- 상세 링크는 `k-startup.go.kr` URL 그대로 `link` 필드에 저장
- 1차 구현에서는 K-Startup 상세 재크롤링 생략

**추출 필드:**
- `title` — 사업공고 제목
- `link` — K-Startup 상세 URL (외부 링크 그대로 보존)
- `raw_deadline` — 사업기간 종료일 파생 가능 시 사용, 불가 시 null
- `category` — 기본값 `창업`, 제목 키워드 기반 세분화
  - `오픈이노베이션`, `초격차`, `예비창업`, `글로벌`, `공간`, `보육` 포함 시 해당 키워드로 분류
- `target` — `예비창업자`, `초기창업기업`, `도약기 창업기업`, `중장년`, `1인 창조기업`
- `source_meta` — `{"source": "KISED", "tier": 3, "page": "misAnnouncement"}`
- `raw` — `{period_text, organization_name, source_page}`

**메타 고정값:**
```python
source = "KISED"
source_type = "semi_public_crawl"
collection_method = "web_crawl"
scope = "national"
region = "전국"
tier = 3
```

**주의:**
- KISED 사업공고 상세는 K-Startup 외부 링크이므로 재크롤링하지 않는다
- 기존 K-Startup 수집 결과와 중복 발생 가능 — 1차 dedupe 기준: `title + link`, 보조: `source + title + deadline`

## 작업 3 — scheduler 등록

**파일:** `backend/rag/collector/scheduler.py`

- `KobiaCollector`, `KisedCollector`가 이미 import/등록되어 있을 수 있으므로 중복 등록 없이 현재 구성을 검토 후 보완
- Tier 1 → Tier 2 → Tier 3 순서로 실행
- 개별 Tier 3 collector 실패 시 다음 collector로 진행, 전체 배치 중단 없음

# Acceptance Criteria

1. `KobiaCollector`가 KOBIA 공지사항 목록에서 1건 이상 추출한다.
2. `KisedCollector`가 KISED 사업공고 목록에서 1건 이상 추출한다.
3. 두 collector 모두 `source_type='semi_public_crawl'`, `tier=3`으로 정규화된다.
4. `run_all_collectors(upsert=False)`를 실행했을 때 Tier 3 collector가 포함된 결과가 출력된다.
5. KOBIA HTTP 응답 실패 또는 KISED 파싱 0건이 전체 배치를 중단시키지 않는다.
6. 수집 실패 시 기존 DB 데이터는 변경되지 않는다.
7. 각 collector 실행 로그에 소스 이름, 수집 건수, 실패 건수가 포함된다.
8. KISED `link` 필드에 `k-startup.go.kr` URL이 그대로 저장된다.

# Constraints

- `BaseCollector` 또는 `BaseHtmlCollector` 기존 인터페이스(`.collect()` 반환 형식) 준수
- `urllib` + `BeautifulSoup` 기반 구조 유지 (브라우저 자동화 사용 금지)
- Supabase upsert 중복 기준: `on_conflict: "title, source"` — 기존 코드와 동일
- Render 512MB 메모리 제약 감안, 페이지 단위 배치 처리 유지
- 환경 변수 추가 불필요 (별도 API 키 없음)
- 기존 Tier 1, Tier 2 collector 동작에 영향 없음

# Non-goals

- KOBIA 공지 상세 본문 파싱 (2차 확장 범위)
- KISED 공지사항/입찰공고 수집 (사업공고 우선)
- KISED 사업공고 상세 재크롤링 (`k-startup.go.kr` 내부 파싱)
- 프론트엔드 `/programs` 허브 UI 변경
- `compare_meta` 필드 채우기
- 수집 자동화 cron/GitHub Actions 설정

# Edge Cases

- KOBIA HTTPS 접근 시도: 연결 거부 발생 → HTTP fallback 로직 내장 또는 HTTP 기준으로 고정
- KOBIA `kabit.or.kr` 구 도메인 진입 시 403/404: 무시, `kobia.or.kr`만 사용
- KISED 사업공고 목록이 0건인 경우: 정상으로 간주하지 않음, 파싱 실패 여부를 로그에 구분 기록
- KISED K-Startup 외부 링크 형식이 바뀐 경우: 링크를 raw 그대로 저장하되 로그에 형식 이상 표시
- K-Startup 기존 수집분과 title+link 중복: upsert 처리로 자연 흡수, 별도 예외 처리 불필요
- 목록 페이지 HTML 구조 변경: 파싱 예외 캐치 후 빈 배열 반환, 로그에 "구조 변경 의심" 기록

# Open Questions

1. KISED 사업공고 페이지네이션 존재 여부 — 1차는 1페이지만 수집하고, 추가 페이지 여부를 구현 중에 확인
2. KOBIA `EVENTSCH`, `REPORT` 게시판 추가 수집 — 1차 범위 외, 2차에서 결정

# Transport Notes

- Local execution target: `tasks/inbox/TASK-2026-04-16-1000-tier3-semi-public-crawl.md`
- Remote fallback target: `tasks/remote/TASK-2026-04-16-1000-tier3-semi-public-crawl.md`
- 실행 전 현재 HEAD가 `9c25b1edf6392821c77aac60968a5bef6cb46ad5`인지 확인한다. 다른 commit이면 drift 검토 후 `planned_against_commit`을 실제 HEAD로 교체하고 영향받는 섹션을 재검토한다.
- 참조 문서: `cowork/drafts/isoser-tier3-semi-public-crawling-validated.md` 또는 업로드된 검증 기획안 전문
- 선행 task: `TASK-2026-04-15-1500-tier2-seoul-crawl` (Tier 2 scheduler 구조 확인 필요)
