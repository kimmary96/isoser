# Tasks Guide

`tasks/`는 문서 보관소가 아니라 watcher 실행 큐입니다.

## Status folders
- `inbox/`: 승인된 실행 대기 packet
- `remote/`: 원격 실행 대기 packet
- `running/`: 현재 실행 중
- `done/`: 완료
- `blocked/`: 멈춤
- `drifted/`: 계획과 현재 상태가 어긋남
- `review-required/`: 검증 후 사람 재검토 필요
- `archive/`: 중복/종료 packet 보관

## Important rule
- 이 폴더는 watcher가 경로를 직접 사용하므로 날짜 폴더로 재배치하지 않습니다.
- 날짜별 탐색은 `TASK-YYYY-MM-DD-...` 파일명 prefix로 찾습니다.
