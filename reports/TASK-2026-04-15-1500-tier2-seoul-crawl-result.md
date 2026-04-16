# TASK-2026-04-15-1500-tier2-seoul-crawl result

## changed files
- `watcher.py`
- `tests/test_watcher.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-15-1500-tier2-seoul-crawl-result.md`

## why changes were made
- Tier 2 서울시 collector task 자체는 이미 구현되어 parser 테스트 6건과 collector import smoke가 통과하는 상태였지만, watcher가 Codex 종료 전 `tasks/running/...` mtime을 갱신하지 않아 stale timeout으로 다시 `blocked` 처리하고 있었다.
- Codex 실행 중 별도 heartbeat 스레드가 `tasks/running/<task>.md`를 주기적으로 touch하도록 보강해, stdout이 잠잠한 장기 실행 작업도 stale running task로 오판되지 않게 했다.
- 이미 성공 조건을 만족한 이 task는 queue 상태만 잘못 남아 있었으므로 `tasks/blocked/`에서 `tasks/done/`으로 수동 정리하고 결과 리포트를 현재 상태에 맞게 다시 작성한다.

## preserved behaviors
- Tier 2 collector parser, scheduler import fallback, 개별 collector 예외 격리 동작은 변경하지 않았다.
- watcher의 stale cleanup 자체는 유지하고, 실제 장기 실행 중인 Codex 작업만 heartbeat로 보호한다.
- blocked / recovery / alert 기록은 감사 이력을 위해 유지한다.

## risks / possible regressions
- heartbeat는 watcher 프로세스가 살아 있는 동안에만 동작하므로, 프로세스 자체가 멈추면 기존 stale cleanup 경로에 계속 의존한다.
- `tasks/running` 파일을 수동으로 삭제하거나 외부 프로세스가 자주 건드리면 heartbeat가 best-effort로만 동작한다.
- 이번 정리는 수동 상태 reconciliation이므로, 과거 `blocked`/`needs-review`/`replan-required` alert 파일은 기록상 남아 있다.

## follow-up refactoring candidates
- stale 판정 전에 Codex child process 생존 여부나 task-scoped pid sidecar를 확인하면 false positive를 더 줄일 수 있다.
- watcher completed alert와 blocked history를 자동 reconciliation하는 maintenance 흐름이 있으면 수동 상태 정리를 줄일 수 있다.

## checks
- `backend/venv/Scripts/python.exe -m pytest backend/tests/test_tier2_collectors.py`
- `backend/venv/Scripts/python.exe -c "import backend.rag.collector.base_html_collector, backend.rag.collector.regional_html_collectors, backend.rag.collector.scheduler; print('import-smoke-ok')"`
- `backend/venv/Scripts/python.exe -m pytest tests/test_watcher.py -k heartbeat`
