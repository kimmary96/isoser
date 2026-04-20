# TASK-2026-04-16-1100-tier4-district-crawl Result

## Changed files

- `backend/rag/collector/tier4_collectors.py`
- `backend/rag/collector/scheduler.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 서울 자치구 Tier 4 수집 계층으로 6개 district collector를 신규 추가했다.
- 각 collector에 `source_type="district_crawl"`, `collection_method="web_crawl"`, `scope="district"`, `region="서울"`, `tier=4`, `region_detail=<구명>` 메타를 고정했다.
- scheduler에 Tier 4 collector import 및 등록을 추가해 기존 tier 정렬 규칙 안에서 dry-run과 실제 배치 경로가 모두 Tier 4를 포함하도록 연결했다.
- 사이트별 제약을 collector 내부에 반영했다.
  - 구로: HTTPS 대신 HTTP 고정
  - 성동: `cntrId=CT00006` 고정 경로와 `programView.do` / `noticeView.do` 상세 링크 조합 사용
  - 노원: Imweb `bmode=view&idx=...&t=board` 패턴 중심 파싱
  - 도봉구청: 키워드 필터 기반 선별 수집
  - 마포: 메인 페이지 기반 프로그램/공지 노출만 파싱

## Preserved behaviors

- `BaseCollector` / `BaseHtmlCollector` 계약과 `.collect()` 반환 형식을 유지했다.
- 기존 Tier 1~3 collector 등록 및 scheduler tier 정렬 로직은 그대로 유지했다.
- source별 실패가 전체 배치를 중단하지 않는 현재 scheduler fail-open 동작을 유지했다.
- upsert 경로의 `(title, source)` dedupe와 `on_conflict="title,source"` 동작은 변경하지 않았다.

## Verification

- `backend\\venv\\Scripts\\python.exe -m py_compile backend/rag/collector/tier4_collectors.py backend/rag/collector/scheduler.py`
  - 통과
- Tier 4 collector 개별 live check
  - `DobongStartupCollector`: 33 items / 33 normalized rows
  - `GuroCollector`: 4 items / 4 normalized rows
  - `SeongdongCollector`: 7 items / 7 normalized rows
  - `NowonCollector`: 10 items / 10 normalized rows
  - `DobongCollector`: 2 items / 2 normalized rows
  - `MapoCollector`: 6 items / 6 normalized rows
- `backend\\venv\\Scripts\\python.exe`로 `run_all_collectors(upsert=False)` 실행
  - Tier 4 source 6종이 모두 `dry_run` 상태로 포함됨
  - Tier 4 dry-run 집계:
    - 도봉구청년창업센터 32 rows
    - 구로 청년이룸 4 rows
    - 서울청년센터 성동 7 rows
    - 노원구 청년일자리센터 청년내일 10 rows
    - 도봉구청 일자리경제과 2 rows
    - 마포구고용복지지원센터 6 rows
  - 전체 `failed_count=2`는 기존 Tier 1 API collector(`Work24Collector`, `KstartupApiCollector`)의 미설정 API key 때문이며 이번 Tier 4 변경과 직접 관련 없음

## Risks / possible regressions

- 외부 HTML 구조 의존성이 높아서 class명, board DOM, onclick 패턴이 바뀌면 수집량이 급감할 수 있다.
- `DobongCollector`는 현재 공지/행사 게시판의 키워드 필터 경로만 구현했고, 메인 배너/팝업 보조 수집은 추가하지 않았다.
- `MapoCollector` 프로그램 링크는 메인에서 노출된 detail href를 그대로 저장하므로, 일부 항목은 내부 `/programview/...` 대신 노출된 short path 또는 외부 신청 링크를 저장할 수 있다.
- scheduler dry-run에서 도봉창업센터는 collector 원시 수집 33건 대비 normalize+d edupe 후 32건으로 줄었다. 동일 title/source 중복 제거 결과로 보이며 저장 계약과는 일치한다.

## Follow-up refactoring candidates

- district HTML collector 공통부를 별도 helper로 추려 `last_collect_status`/`empty_message` 패턴과 raw dict 구성을 더 일관되게 정리할 수 있다.
- 마포와 도봉구청 보조(main/banner) 수집은 후속 task에서 source별 노이즈 기준을 다시 검증한 뒤 별도 parser로 분리하는 편이 안전하다.
