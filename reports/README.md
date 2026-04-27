# Reports Guide

`reports/`는 watcher 산출물, 직접 세션 결과, 운영 진단 artifact를 함께 보관하는 폴더입니다.

## Root rules
- 루트에는 watcher가 직접 참조하는 `TASK-*` 보고서를 유지합니다.
- `TASK-*`는 `reports/<task-id>-...` 경로를 watcher가 직접 사용하므로 임의 이동하지 않습니다.
- 직접 대화 작업 결과는 `reports/session/YYYY-MM/SESSION-YYYY-MM-DD-...-result.md`에 둡니다.

## Folder map
- `session/YYYY-MM/`: 직접 대화 세션 결과 보고
- `diagnostics/html-collector/`: HTML collector 진단 JSON, md, snapshot
- `ops/work24/`: Work24 운영/백필/동기화 결과
- `ops/program-validation/`: 샘플 검증 JSON
- `ops/backend/`: 백엔드 운영성 점검 메모
- `benchmarks/queue/YYYY-MM/`: 큐/벤치마크 산출물
- `ad-hoc/programs/`: 프로그램 화면/검색/필터 수동 점검 결과
- `visual-qa/program-detail/`: 프로그램 상세 시각 QA 이미지와 보고서

## How to find
- watcher task 보고서: `TASK-2026-04-24-*`
- 직접 세션 보고서: `reports/session/2026-04/SESSION-2026-04-24-*`
- HTML collector 진단: `reports/diagnostics/html-collector/2026-04-24/*`
- Work24 운영 결과: `reports/ops/work24/*`
