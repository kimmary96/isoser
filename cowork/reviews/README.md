# Review Storage Guide

`cowork/reviews/`는 `cowork_watcher.py`가 생성하는 review 산출물 저장소입니다.

## Naming
- 기본 형식: `TASK-YYYY-MM-DD-....-review.md`
- 예외적으로 task가 아닌 참조 review 문서는 별도 이름을 가질 수 있습니다.

## Important rule
- watcher와 dispatch가 `cowork/reviews/<task-id>-review.md` 경로를 직접 사용하므로 날짜 폴더로 이동하지 않습니다.
- 날짜별 탐색은 파일명 prefix로 찾습니다.

## Quick find tips
- 특정 날짜 review: `TASK-2026-04-24-*-review.md`
- 특정 task review: `<task-id>-review.md`
