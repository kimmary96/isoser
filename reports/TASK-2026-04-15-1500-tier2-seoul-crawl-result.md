# TASK-2026-04-15-1500-tier2-seoul-crawl result

## changed files
- `backend/rag/collector/base_html_collector.py`
- `backend/rag/collector/scheduler.py`
- `docs/refactoring-log.md`

## why changes were made
- Tier 2 서울시 collector 6종의 parser 테스트가 모두 `BaseHtmlCollector.soup_from_html()` 부재로 실패하고 있었기 때문에, 기존 parser 구현을 건드리지 않고 공통 HTML 파싱 유틸만 최소 범위로 복구했다.
- `scheduler.py`는 이미 worktree에 있던 import fallback 보강이 task 목표와 일치하는지 확인했고, `rag.*` 패키지 경로 차이에서만 fallback 하도록 유지해 실행 환경별 import 안정성을 확보했다.

## preserved behaviors
- 기존 Tier 2 collector별 selector, category 추론, target 매핑 로직은 변경하지 않았다.
- scheduler의 collector 순서 정렬과 개별 collector 예외 격리 동작은 유지했다.
- `backend` 패키지 기준 import와 `rag` 패키지 기준 import 모두 계속 로드 가능함을 확인했다.

## risks / possible regressions
- 현재 검증은 parser 단위 테스트와 import smoke check 중심이며, 실사이트 HTML 변경 여부나 네트워크 수집 성공까지는 보장하지 않는다.
- `BeautifulSoup` 의존성이 없는 환경에서는 여전히 regional collector import가 실패할 수 있으므로 backend 의존성 설치가 전제된다.

## follow-up refactoring candidates
- `collect_items()`의 요청/예외 처리 패턴이 6개 collector에 반복되므로, 이후 task에서 공통 list-url fetch helper로 정리할 여지가 있다.
- scheduler의 import fallback 패턴은 collector 패키지 공용 bootstrap helper로 이동하면 다른 실행 entrypoint와 중복을 줄일 수 있다.

## checks
- `backend/venv/Scripts/python.exe -m pytest backend/tests/test_tier2_collectors.py`
- `backend/venv/Scripts/python.exe`로 `backend.rag.collector.base_html_collector`, `backend.rag.collector.regional_html_collectors`, `backend.rag.collector.scheduler` import smoke check
