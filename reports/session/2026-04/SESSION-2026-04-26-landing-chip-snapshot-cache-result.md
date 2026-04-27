# SESSION-2026-04-26-landing-chip-snapshot-cache-result

## 변경 파일
- `supabase/migrations/20260426143000_add_program_landing_chip_snapshots.sql`
- `scripts/refresh_program_list_index.py`
- `backend/tests/test_program_list_refresh_fallback.py`
- `frontend/lib/server/public-program-snapshot-utils.ts`
- `frontend/lib/server/public-programs-fallback.ts`
- `frontend/lib/server/public-programs-fallback.test.ts`
- `frontend/app/(landing)/landing-c/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 랜딩 `Opportunity feed`가 칩 변경마다 runtime query + fallback scan을 반복해 첫 진입과 재진입 응답이 흔들릴 수 있었다.
- 사용자는 하루 동안 카드 6개가 고정되고, KST 자정 program list refresh와 같은 타이밍에 카드도 같이 갱신되길 원했다.
- 브라우저 로컬 캐시만으로는 첫 방문 속도와 서버 일관성을 해결하지 못하므로, DB read-model snapshot을 추가했다.

## 무엇을 바꿨는가
- `program_landing_chip_snapshots` 테이블과 `refresh_program_landing_chip_snapshots(surface, item_limit)` RPC를 추가했다.
- 기존 `refresh_program_list_browse_pool_daily_resilient(...)` 끝에서 랜딩 snapshot refresh를 같이 호출하도록 묶었다.
- 수동 `scripts/refresh_program_list_index.py` 경로도 browse refresh 성공 뒤 snapshot refresh를 best-effort로 같이 호출하도록 확장했다.
- `landing-c`는 keyword가 없을 때 오늘(KST) snapshot이 6개 이상 있으면 그 후보만으로 카드를 렌더링하고, snapshot이 없거나 부족할 때만 기존 동적 fetch/top-up 경로를 탄다.

## 유지한 동작
- snapshot 테이블/RPC가 아직 없는 DB에서도 랜딩 페이지는 기존 `listProgramsPage + legacy fallback` 경로로 계속 동작한다.
- keyword 검색 랜딩 경로는 기존처럼 dynamic fetch를 유지한다.
- `무료`, `온라인`, `창업` 등 최근에 보강한 칩 의미와 부족분 top-up fallback은 snapshot이 부족할 때 그대로 재사용된다.

## 리스크 / 가능 회귀
- snapshot SQL의 칩 의미는 프런트 matcher를 최대한 따라갔지만 완전히 동일한 구현은 아니므로 일부 칩의 후보 집합이 runtime fallback과 약간 다를 수 있다.
- snapshot item JSON은 read-model/programs 조합으로 직접 만들기 때문에, backend serializer에서 나중에 추가되는 표시 필드를 즉시 자동 상속하지는 않는다.
- 자정 job은 snapshot refresh까지 같이 수행하므로 browse refresh가 정상이어도 snapshot function이 느려지면 cron 전체 시간이 늘 수 있다.

## 테스트 / 검증
- `frontend`: `npm test -- lib/program-filters.test.ts lib/program-display.test.ts lib/server/program-card-summary.test.ts lib/server/public-programs-fallback.test.ts 'app/(landing)/landing-c/_program-utils.test.ts'`
- `frontend`: `npx tsc --noEmit --pretty false`
- `backend`: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_program_list_refresh_fallback.py`

## 추가 리팩토링 후보
- 랜딩 snapshot 칩 정의를 프런트 상수와 DB function 사이에서 한 번 더 공유 가능한 형태로 정리할지 검토
- `landing-a`나 `/programs` 상단 추천 strip도 같은 snapshot/read-model 전략으로 옮길지 판단
- snapshot item JSON 대신 `program_ids + shared summary loader`로 더 얇게 가져갈지 운영 데이터 안정화 후 재검토
