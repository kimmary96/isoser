# Reports Guide

`reports/`는 watcher 산출물과 직접 세션 결과가 함께 쌓이는 폴더입니다.

## File groups
- `TASK-*.md`: watcher/local queue task 결과, drift, blocked, recovery, supervisor 산출물
- `SESSION-*.md`: 대화 세션 기반 직접 작업 결과 보고
- 나머지 `*.md`: 운영 메모, 성능 비교, 진단 보고
- `*.json`, `*.png`, `*.svg`, `*.html`: 검증/시각화 artifact

## Important rule
- `TASK-*` 보고서는 watcher가 `reports/<task-id>-...` 경로를 직접 참조하므로 임의 이동하지 않습니다.
- direct work 문서는 앞으로도 `SESSION-YYYY-MM-DD-...` 규칙을 유지합니다.

## How to find by date
- 파일명 prefix로 바로 찾습니다.
- 예: `TASK-2026-04-24-*`, `SESSION-2026-04-24-*`, `*2026-04-23*`
