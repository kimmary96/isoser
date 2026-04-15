---
id: TASK-2026-04-15-1500-tier2-seoul-crawl
status: queued
type: feature
title: "Tier 2 서울시 광역 크롤링 collector 구현 — Phase 1~2"
planned_at: "2026-04-15"
planned_against_commit: "750fba4f766f86739e94368afa8474e2edbdc6b4"
priority: high
planned_by: Claude (PM)
auto_recovery_attempts: 1
---

## Goal

서울시 광역 단위 프로그램 데이터를 이소서 프로그램 허브에 공급하기 위해,
`backend/rag/collector/` 구조에 Tier 2 HTML collector를 추가한다.

대상은 로컬 HTTP 요청으로 목록 및 상세 응답이 실제 검증된 소스에 한정한다.
청년몽땅정보통(WebGate 차단)과 서울창업허브(연결 불안정)는 이번 범위에서 제외한다.

이번 Task Packet의 범위는 Phase 1(즉시 구현 가능 3개)과 Phase 2(안정 확장 3개)이다.
Phase 3, Phase 4는 별도 Packet으로 분리한다.

---

## User Flow

이 기능은 사용자 직접 노출 기능이 아니라 데이터 수집 파이프라인이다.

1. 배치 수집 실행 시 Tier 2 collector들이 순서대로 실행된다.
2. 각 collector는 대상 사이트의 목록 페이지에서 프로그램 제목, 링크, 마감일, 카테고리를 수집한다.
3. 필요한 경우(마감일 또는 카테고리 미확인 시)에 한해 상세 페이지에 진입한다.
4. 수집 결과는 기존 normalizer를 거쳐 Supabase `programs` 테이블에 upsert된다.
5. 한 collector 실패가 전체 배치를 중단시키지 않는다.

---

## 구현 대상 소스

### Phase 1: 즉시 구현 (검증 완료)

**SeoulJobPortalCollector**
- 사이트: 서울일자리포털
- 진입 경로: `/hmpg/main/main.do` 기반 프로그램 목록 및 공지 영역
- 수집 대상: 매력일자리, 청년인턴 직무캠프, 취업지원, 일자리카페 관련 모집 공고
- 주의: 일반 채용 정보와 정책형 프로그램이 혼재. 프로그램형 공고 중심 필터 필요.
- category_hint: `취업`

**SbaPostingCollector**
- 사이트: 서울경제진흥원 사업신청
- 진입 경로: `/Pages/BusinessApply/Posting.aspx`
- 수집 대상: 전체 사업 또는 접수중인 사업. 창업/교육/세미나행사/일자리 카테고리.
- 검증 상태: 메인 및 사업 구조 HTML 정상 수신 확인
- category_hint: 카테고리 구분 가능하면 소스에서 직접 매핑

**SesacCollector**
- 사이트: 청년취업사관학교 SeSAC
- 진입 경로: `/sesac/main/main.do`, `/sesac/course/offline/` 과정 목록
- 수집 대상: 모집중 오프라인 과정. 모집 기간이 HTML에 직접 노출됨.
- 검증 상태: 메인 및 상세 페이지 응답 모두 확인
- category_hint: `교육`

### Phase 2: 안정 확장 (응답 확인, 필터 기준 필요)

**Seoul50PlusCollector**
- 사이트: 서울시 50플러스 일자리 정보몽땅
- 수집 대상: 일자리형, 교육형, 공지형 모집 데이터
- 주의: 중장년 대상 소스. 서울시 광역 프로그램 수집 목적으로는 유효하나 청년 타겟 필터 고려.
- category_hint: 카드 유형에 따라 `취업` 또는 `교육`

**CampusTownCollector**
- 사이트: 서울캠퍼스타운
- 수집 대상: 프로그램 모집 일정, 사업공고, 행사·네트워킹, 창업경진대회
- 특이사항: HTML data attribute(`data-title`, `data-url`, `data-startDate`, `data-endDate`)에 구조화된 데이터 직접 존재. 파싱 난이도 낮음.
- category_hint: `창업` 또는 `네트워킹`

**SeoulWomanUpCollector**
- 사이트: 서울커리업(구 서울우먼업)
- 진입 경로: `/womanup/main/main.do`, `/womanup/edu/selectThisMonthPageList.do`
- 수집 대상: 교육 프로그램 신청, 이달의 프로그램, 인턴십 모집, 공지사항
- 주의: 일부 목록이 JavaScript로 렌더링. HTML 내 링크 흔적과 데이터 소스로 우선 시도.
- category_hint: `취업` 또는 `교육`

---

## 공통 수집 필드

필수:
- `source` — 소스 식별자 (예: `sesac`, `sba_posting`)
- `source_type` = `'regional_crawl'`
- `collection_method` = `'web_crawl'`
- `scope` = `'seoul'`
- `region` = `'서울'`
- `title`
- `link`
- `raw` — 원본 HTML 또는 파싱 원문

가능하면 포함:
- `deadline`
- `category_hint`
- `target`
- `sponsor_name`
- `start_date`
- `end_date`

고정값:
- `is_ad` = `False`

---

## 카테고리 기준

초기 구현에서는 각 collector가 `category_hint`를 직접 넣는 방식을 사용한다.
현재 `normalizer.py`가 서울시 프로그램 용어를 완전히 반영하지 않기 때문이다.

기준:
- 취업지원, 인턴, 채용연계, 일자리카페 → `취업`
- 창업지원, 입주, 공모전, 사업화 → `창업`
- 아카데미, 과정, 직무훈련 → `교육`
- 네트워킹, 커뮤니티데이, IR, 행사 → `네트워킹`

---

## 중복 제거 기준

1차: `source + title + deadline`
2차: `source + link`
보조: deadline이 없는 경우 `source + title`

교차 소스 간 완전 중복 제거는 이번 범위 밖이다.
우선 소스 내부 중복과 동일 링크 중복만 안정적으로 제거한다.

---

## Acceptance Criteria

- Phase 1 collector 3개(`SeoulJobPortalCollector`, `SbaPostingCollector`, `SesacCollector`)가 실행되어 각각 1건 이상의 데이터를 Supabase `programs` 테이블에 적재한다.
- Phase 2 collector 3개(`Seoul50PlusCollector`, `CampusTownCollector`, `SeoulWomanUpCollector`)도 동일 기준을 충족한다.
- 6개 collector 중 하나가 실패해도 나머지 collector는 계속 실행된다.
- 수집 결과에 `source`, `source_type`, `collection_method`, `scope`, `region`, `title`, `link` 필드가 모두 존재한다.
- 0건 수집 시 성공으로 처리하지 않는다.
- 기존 DB 데이터는 삭제하지 않는다.
- 기존 `BaseCollector` 상속 구조를 따른다.
- Tier 1 collector 실행 이후 Tier 2가 실행되는 순서가 유지된다.

---

## Constraints

- 기존 `backend/rag/collector/` 구조(BaseCollector, normalizer, scheduler)를 변경하지 않는다.
- 브라우저 자동화(Playwright, Selenium 등)를 이번 구현에 사용하지 않는다. urllib + BeautifulSoup으로 우선 해결한다.
- User-Agent는 브라우저형으로 통일한다.
- API 키나 인증 정보를 코드에 직접 작성하지 않는다.
- 상세 페이지 진입은 목록에서 마감일/카테고리 확보가 안 되는 경우에만 수행한다.
- 단독 스크립트로 테스트 실행이 가능해야 한다.

---

## Non-goals

- Phase 3(`SmycCollector`)는 이번 범위에 포함하지 않는다.
- Phase 4(`SeoulYouthCollector`, `SeoulStartupHubCollector`)는 고위험 소스로 이번 범위에 포함하지 않는다.
- 자치구 단위 소스는 Tier 4 범위이며 이 Packet 대상이 아닙니다.
- normalizer.py 전체 개선은 이번 범위 밖이다.
- 교차 소스 간 중복 제거는 이번 범위 밖이다.
- 프론트엔드 프로그램 허브 화면 변경은 이번 범위 밖이다.

---

## Edge Cases

- `SeoulJobPortalCollector`: 일반 채용 공고와 정책형 모집 공고가 혼재 → 제목 또는 카테고리 패턴으로 필터 필요. 필터 기준은 구현 시점에 판단.
- `SbaPostingCollector`: 접수중인 사업만 대상으로 할지 전체 사업을 대상으로 할지 판단 필요. 초기에는 접수중 우선 권장.
- `Seoul50PlusCollector`: 중장년 대상 데이터가 다수. 이소서 핵심 타겟(취업 공백자, 청년 커리어 체인저)과 맞지 않을 수 있음. `target` 필드에 대상 정보 명시하여 프론트에서 필터 가능하도록 처리.
- `SeoulWomanUpCollector`: 일부 목록이 JavaScript 렌더링 의존 → HTML에서 추출 가능한 데이터만 우선 수집. 이후 보완 방식은 별도 확인.
- 사이트 구조 변경 시: 3회 연속 0건이면 selector 점검 대상으로 기록.
- 연결 실패/타임아웃: 즉시 다음 collector로 진행, 실패 로그 남김.
- WebGate 차단 응답 수신 시: 구조 실패로 기록 (이번 Packet 대상 소스에는 해당 없음).

---

## Open Questions

1. `programs` 테이블이 현재 Supabase에 생성되어 있는지 확인 필요. 없으면 migration 선행 필요.
2. `normalizer.py`의 현재 필드 구조가 `category_hint`, `scope`, `region_detail` 등을 수용하는지 확인 필요.
3. Tier 1 collector와 Tier 2 collector의 실행 순서가 `scheduler.py`에서 어떻게 관리되는지 확인 필요.
4. `Seoul50PlusCollector` 수집 데이터를 타겟 필터 없이 전부 적재할지, 프로그램 유형 기준으로 1차 필터할지 결정 필요.
5. 배치 실행 주기(하루 1회인지 주기적인지)가 이미 정해져 있는지 확인 필요.

---

## 참고

- 이번 Packet의 기반 문서: `isoser-tier2-seoul-crawling-validated.md`, `isoser-tier2-seoul-crawling-detailed.md` (2026-04-15 기준 로컬 HTTP 검증 완료)
- 이 Packet은 stale watcher run 이후 자동 복구를 위해 현재 `HEAD`로 재기준화되었다. 재시도 시에는 실제 구현 전 관련 collector 구조와 drift를 다시 확인할 것.
- Phase 3(`SmycCollector`) Packet은 서울광역청년센터 게시판 URL 역추적 완료 후 별도 작성.
- Phase 4 Packet은 WebGate 우회 방안 또는 서울창업허브 도메인 안정화 확인 후 별도 작성.

## Auto Recovery Context

- source_task: `tasks/blocked/TASK-2026-04-15-1500-tier2-seoul-crawl.md`
- failure_stage: `blocked`
- failure_report: `reports/TASK-2026-04-15-1500-tier2-seoul-crawl-blocked.md`
- recovery_report: `reports/TASK-2026-04-15-1500-tier2-seoul-crawl-recovery.md`
- reviewer_action: update the packet or provide approval/feedback before requeueing
